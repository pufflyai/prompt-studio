import { and, asc, count, eq, gt, gte, inArray, isNull, lt } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import {
  type AutomationRunError,
  type AutomationRunStatus,
  automation_principals,
  automation_run_events,
  automation_runs,
  automation_tokens,
} from "../../db/schemas.pg";

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

const createAutomationTokenDBService = (db: DbClient) => {
  const createToken = async (input: {
    name: string;
    createdBy: string;
    principalId?: string;
    tokenId: string;
    tokenPrefix: string;
    tokenDigest: string;
    projectId: string;
    commandScopes: string[];
    expiresAt: string;
  }) => {
    const createdAt = nowTimestamp();
    return db.transaction(async (tx) => {
      const [existingPrincipal] = input.principalId
        ? await tx
            .select()
            .from(automation_principals)
            .where(
              and(
                eq(automation_principals.id, input.principalId),
                eq(automation_principals.project_id, input.projectId),
              ),
            )
        : [];
      if (input.principalId && !existingPrincipal) throw new Error("Automation principal not found for project.");
      const principal =
        existingPrincipal ??
        (
          await tx
            .insert(automation_principals)
            .values({
              id: crypto.randomUUID(),
              project_id: input.projectId,
              name: input.name,
              created_by: input.createdBy,
              created_at: createdAt,
              disabled_at: null,
            })
            .returning()
        )[0];
      const [token] = await tx
        .insert(automation_tokens)
        .values({
          id: input.tokenId,
          principal_id: principal.id,
          token_prefix: input.tokenPrefix,
          token_digest: input.tokenDigest,
          project_id: input.projectId,
          command_scopes_json: input.commandScopes,
          expires_at: input.expiresAt,
          last_used_at: null,
          revoked_at: null,
          created_at: createdAt,
        })
        .returning();
      return { principal, token };
    });
  };

  const getToken = async (id: string) => {
    const [row] = await db
      .select({ principal: automation_principals, token: automation_tokens })
      .from(automation_tokens)
      .innerJoin(automation_principals, eq(automation_tokens.principal_id, automation_principals.id))
      .where(eq(automation_tokens.id, id));
    return row ?? null;
  };

  const getPrincipal = async (projectId: string, principalId: string) => {
    const [principal] = await db
      .select()
      .from(automation_principals)
      .where(and(eq(automation_principals.id, principalId), eq(automation_principals.project_id, projectId)));
    return principal ?? null;
  };

  const listTokens = (projectId: string) =>
    db
      .select({ principal: automation_principals, token: automation_tokens })
      .from(automation_tokens)
      .innerJoin(automation_principals, eq(automation_tokens.principal_id, automation_principals.id))
      .where(eq(automation_tokens.project_id, projectId))
      .orderBy(asc(automation_tokens.created_at));

  const markTokenUsed = (id: string) =>
    db.update(automation_tokens).set({ last_used_at: nowTimestamp() }).where(eq(automation_tokens.id, id));

  const revokeToken = async (id: string) => {
    const [row] = await db
      .update(automation_tokens)
      .set({ revoked_at: nowTimestamp() })
      .where(and(eq(automation_tokens.id, id), isNull(automation_tokens.revoked_at)))
      .returning();
    return row ?? (await getToken(id))?.token ?? null;
  };

  return { createToken, getPrincipal, getToken, listTokens, markTokenUsed, revokeToken };
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
    tokenId: string;
    commandId: string;
    idempotencyKey: string;
    inputHash: string;
    inputJson: Record<string, unknown>;
  }) => {
    return db.transaction(async (tx) => {
      const createdAt = nowTimestamp();
      const [owner] = await tx
        .select({ tokenId: automation_tokens.id })
        .from(automation_tokens)
        .innerJoin(
          automation_principals,
          and(
            eq(automation_tokens.principal_id, automation_principals.id),
            eq(automation_tokens.project_id, automation_principals.project_id),
          ),
        )
        .where(
          and(
            eq(automation_tokens.id, input.tokenId),
            eq(automation_principals.id, input.principalId),
            eq(automation_principals.project_id, input.projectId),
          ),
        );
      if (!owner) throw new Error("Automation run ownership does not match.");
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
      if (!current || terminalStatuses.has(current.status)) return current ?? null;
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
      if (updated) return updated;
      const [settled] = await tx.select().from(automation_runs).where(eq(automation_runs.id, runId));
      return settled ?? null;
    });
  };

  const listRunEvents = (runId: string, after = 0) =>
    db
      .select()
      .from(automation_run_events)
      .where(and(eq(automation_run_events.run_id, runId), gt(automation_run_events.cursor, after)))
      .orderBy(asc(automation_run_events.cursor));

  const recoverInterruptedRuns = async () => {
    const running = await db.select().from(automation_runs).where(eq(automation_runs.status, "running"));
    for (const run of running) {
      await transitionRun(run.id, {
        status: "failed",
        error: { code: "host_restarted", message: "The host restarted during command execution.", retryable: true },
      });
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
  ...createAutomationRunDBService(db),
});
