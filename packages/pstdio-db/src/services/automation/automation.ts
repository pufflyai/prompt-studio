import { and, asc, count, eq, gt, gte, inArray, lt } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import {
  type AutomationRunError,
  type AutomationRunStatus,
  automation_principals,
  automation_run_events,
  automation_runs,
  automation_tokens,
} from "../../db/schemas.pg";
import { createAutomationTokenDBService } from "./automation-tokens";
import { createExtensionAutomationDBService } from "./extension-automation";

const nowTimestamp = () => new Date().toISOString();
const terminalStatuses = new Set<AutomationRunStatus>(["succeeded", "failed", "cancelled", "rejected"]);
const MAX_EVENT_PAYLOAD_BYTES = 16 * 1024;
const textEncoder = new TextEncoder();

const transitionPatch = (
  input: { status: AutomationRunStatus; result?: unknown; error?: AutomationRunError },
  changedAt: string,
) => ({
  status: input.status,
  ...(input.status === "running" ? { started_at: changedAt } : {}),
  ...(terminalStatuses.has(input.status) ? { finished_at: changedAt } : {}),
  ...(input.result !== undefined ? { result_json: input.result } : {}),
  ...(input.error ? { error_json: input.error } : {}),
});

const transitionEventPayload = (error?: AutomationRunError) => {
  const payload = error ? { error } : {};
  return textEncoder.encode(JSON.stringify(payload)).byteLength > MAX_EVENT_PAYLOAD_BYTES
    ? { truncated: true }
    : payload;
};

const createAutomationRunDBService = (db: DbClient) => {
  const getRunByIdempotency = async (input: {
    principalId: string;
    projectId: string;
    commandId: string;
    idempotencyKey: string;
  }) => {
    const [row] = await db
      .select()
      .from(automation_runs)
      .where(
        and(
          eq(automation_runs.principal_id, input.principalId),
          eq(automation_runs.project_id, input.projectId),
          eq(automation_runs.command_id, input.commandId),
          eq(automation_runs.idempotency_key, input.idempotencyKey),
        ),
      );
    return row ?? null;
  };

  const countRecentRuns = async (input: { principalId: string; projectId: string; since: string }) => {
    const [row] = await db
      .select({ value: count() })
      .from(automation_runs)
      .where(
        and(
          eq(automation_runs.principal_id, input.principalId),
          eq(automation_runs.project_id, input.projectId),
          gte(automation_runs.created_at, input.since),
        ),
      );
    return row?.value ?? 0;
  };

  const appendEvent = async (runId: string, type: string, payload: Record<string, unknown> = {}) => {
    const storedPayload =
      textEncoder.encode(JSON.stringify(payload)).byteLength > MAX_EVENT_PAYLOAD_BYTES ? { truncated: true } : payload;
    const [event] = await db
      .insert(automation_run_events)
      .values({ run_id: runId, type, payload_json: storedPayload, created_at: nowTimestamp() })
      .returning();
    return event;
  };

  const createRun = async (input: {
    projectId: string;
    principalId: string;
    tokenId: string | null;
    commandId: string;
    idempotencyKey: string;
    inputHash: string;
    inputJson: Record<string, unknown>;
  }) => {
    return db.transaction(async (tx) => {
      const createdAt = nowTimestamp();
      const [owner] = await tx
        .select()
        .from(automation_principals)
        .where(
          and(eq(automation_principals.id, input.principalId), eq(automation_principals.project_id, input.projectId)),
        );
      if (!owner) throw new Error("Automation run ownership does not match.");
      if (input.tokenId !== null) {
        const [token] = await tx
          .select()
          .from(automation_tokens)
          .where(
            and(
              eq(automation_tokens.id, input.tokenId),
              eq(automation_tokens.principal_id, input.principalId),
              eq(automation_tokens.project_id, input.projectId),
            ),
          );
        if (!token) throw new Error("Automation run ownership does not match.");
      }
      const [created] = await tx
        .insert(automation_runs)
        .values({
          id: crypto.randomUUID(),
          project_id: input.projectId,
          principal_id: input.principalId,
          token_id: input.tokenId,
          command_id: input.commandId,
          idempotency_key: input.idempotencyKey,
          input_hash: input.inputHash,
          input_json: input.inputJson,
          status: "queued",
          result_json: null,
          error_json: null,
          created_at: createdAt,
          started_at: null,
          finished_at: null,
        })
        .onConflictDoNothing()
        .returning();
      if (created) {
        await tx
          .insert(automation_run_events)
          .values({ run_id: created.id, type: "queued", payload_json: {}, created_at: createdAt });
        return { run: created, created: true };
      }
      const [existing] = await tx
        .select()
        .from(automation_runs)
        .where(
          and(
            eq(automation_runs.principal_id, input.principalId),
            eq(automation_runs.project_id, input.projectId),
            eq(automation_runs.command_id, input.commandId),
            eq(automation_runs.idempotency_key, input.idempotencyKey),
          ),
        );
      if (!existing) throw new Error("Automation idempotency lookup failed.");
      return { run: existing, created: false };
    });
  };

  const getRun = async (projectId: string, runId: string) => {
    const [row] = await db
      .select()
      .from(automation_runs)
      .where(and(eq(automation_runs.project_id, projectId), eq(automation_runs.id, runId)));
    return row ?? null;
  };

  const getRunById = async (runId: string) => {
    const [row] = await db.select().from(automation_runs).where(eq(automation_runs.id, runId));
    return row ?? null;
  };

  const claimQueuedRun = async (runId: string) => {
    return db.transaction(async (tx) => {
      const createdAt = nowTimestamp();
      const [claimed] = await tx
        .update(automation_runs)
        .set({ status: "running", started_at: createdAt })
        .where(and(eq(automation_runs.id, runId), eq(automation_runs.status, "queued")))
        .returning();
      if (claimed) {
        await tx
          .insert(automation_run_events)
          .values({ run_id: runId, type: "running", payload_json: {}, created_at: createdAt });
      }
      return claimed ?? null;
    });
  };

  const transitionRun = async (
    runId: string,
    input: { status: AutomationRunStatus; result?: unknown; error?: AutomationRunError },
  ) => {
    return db.transaction(async (tx) => {
      const [current] = await tx.select().from(automation_runs).where(eq(automation_runs.id, runId));
      if (!current || terminalStatuses.has(current.status) || current.status === input.status) return null;
      const changedAt = nowTimestamp();
      const [updated] = await tx
        .update(automation_runs)
        .set(transitionPatch(input, changedAt))
        .where(and(eq(automation_runs.id, runId), eq(automation_runs.status, current.status)))
        .returning();
      if (updated) {
        await tx.insert(automation_run_events).values({
          run_id: runId,
          type: input.status,
          payload_json: transitionEventPayload(input.error),
          created_at: changedAt,
        });
      }
      return updated ?? null;
    });
  };

  const listRunEvents = (runId: string, after = 0) =>
    db
      .select()
      .from(automation_run_events)
      .where(and(eq(automation_run_events.run_id, runId), gt(automation_run_events.cursor, after)))
      .orderBy(asc(automation_run_events.cursor));

  const recoverInterruptedRuns = async (onRecovered?: (run: typeof automation_runs.$inferSelect) => Promise<void>) => {
    const running = await db.select().from(automation_runs).where(eq(automation_runs.status, "running"));
    for (const run of running) {
      const recovered = await transitionRun(run.id, {
        status: "failed",
        error: { code: "host_restarted", message: "The host restarted during command execution.", retryable: true },
      });
      if (recovered) await onRecovered?.(recovered);
    }
    return running.length;
  };

  const listQueuedRuns = () => db.select().from(automation_runs).where(eq(automation_runs.status, "queued"));

  const pruneTerminalRuns = (before: string) =>
    db
      .delete(automation_runs)
      .where(and(inArray(automation_runs.status, [...terminalStatuses]), lt(automation_runs.finished_at, before)))
      .returning({ id: automation_runs.id });

  return {
    appendEvent,
    claimQueuedRun,
    countRecentRuns,
    createRun,
    getRun,
    getRunById,
    getRunByIdempotency,
    listRunEvents,
    listQueuedRuns,
    pruneTerminalRuns,
    recoverInterruptedRuns,
    transitionRun,
  };
};

export const createAutomationDBService = (db: DbClient) => ({
  ...createAutomationTokenDBService(db),
  ...createExtensionAutomationDBService(db),
  ...createAutomationRunDBService(db),
});
