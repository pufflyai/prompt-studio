import { type CommandContext, defineCommand, params, type SessionRunSnapshot } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { legacyAttemptOutput } from "../data/attempt-compatibility";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { appendAttemptEvent, listAttempts, putAttempt, readAttempt } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { readSessionHistory } from "../data/session-history";
import { withWriteGuard } from "../data/write-guard";
import { readImplementationCapacity } from "./attempt-readiness";
import { isLiveSession } from "./auto-build-sessions";
import { blockAttempt } from "./reconcile-blocker";
import { reconcileReview } from "./reconcile-review";

const liveStatuses = new Set(["queued", "in_progress", "awaiting_input"]);

const retryImplementation = async (ctx: CommandContext, attempt: AttemptRecord, expectedRun: SessionRunSnapshot) => {
  const session = await ctx.sessions.get(attempt.implementationSessionId);
  if (!session) throw new Error("Implementation owner is missing.");
  const capacity = await readImplementationCapacity(ctx);
  if (capacity.running >= capacity.limit) throw new Error("Implementation capacity is full.");
  if (
    (await readSessionHistory(ctx.sessions, { workspaceId: attempt.workspaceId })).some(
      (other) => other.id !== session.id && isLiveSession(other),
    )
  )
    throw new Error("Another session is executing in this workspace.");
  await ctx.sessions.followup({
    sessionId: attempt.implementationSessionId,
    expectedRun,
    prompt: `Resume implementation for ${attempt.workspaceShorthand} after the first disconnect. Keep the same workspace and attempt.`,
  });
  const next = await putAttempt(ctx.storage, {
    ...attempt,
    implementationDisconnectRetries: attempt.implementationDisconnectRetries + 1,
    updatedAt: new Date().toISOString(),
  });
  await appendAttemptEvent(ctx.storage, {
    workspaceId: attempt.workspaceId,
    revision: attempt.revisions.at(-1)?.revision ?? null,
    type: "implementation_resumed",
    actor: actorFromSource(ctx.source, ctx.invocationId),
    sessionId: attempt.implementationSessionId,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: attempt.revisions.at(-1)?.headSha ?? null,
    metadata: { retryCount: next.implementationDisconnectRetries },
  });
  return { decision: "implementation-retried" as const, attempt: next };
};

const reconcileImplementation = async (
  ctx: CommandContext,
  attempt: AttemptRecord,
  expectedRun?: SessionRunSnapshot,
) => {
  const session = await ctx.sessions.get(attempt.implementationSessionId);
  if (liveStatuses.has(session?.status ?? "")) return { decision: "active" as const, attempt };
  const unexpected =
    session?.status === "disconnected" ||
    ["request_aborted", "worker_lost", "host_shutdown"].includes(session?.last_exit?.cause ?? "");
  if (unexpected && attempt.implementationDisconnectRetries === 0) {
    return retryImplementation(
      ctx,
      attempt,
      expectedRun ?? {
        status: session!.status!,
        startedAt: session!.last_request_started ?? null,
        endedAt: session!.last_request_ended ?? null,
      },
    );
  }
  if (unexpected || session?.status === "failed") {
    const blocked = await blockAttempt(ctx, attempt, {
      phase: "implementation",
      sessionId: attempt.implementationSessionId,
      reason: `Implementation session ended as ${session?.status}.`,
      retryCount: attempt.implementationDisconnectRetries,
    });
    return { decision: "blocked" as const, attempt: blocked };
  }
  if (session?.status === "cancelled") return { decision: "stopped" as const, attempt };
  return { decision: "awaiting-change-request" as const, attempt };
};

export const reconcileAttempt = async (
  ctx: CommandContext,
  commandParams: { workspaceId: string; expectedRun?: SessionRunSnapshot },
) => {
  return withWriteGuard(ctx, `attempt:${commandParams.workspaceId}`, async () => {
    const attempt = await readAttempt(ctx.storage, commandParams.workspaceId);
    if (!attempt) throw new Error(`Unknown managed attempt "${commandParams.workspaceId}"`);
    const retired = (await readRetiredWorkspaceIds(ctx.storage)).has(attempt.workspaceId);
    if (retired) return { decision: "unchanged" as const, attempt };
    const session = await ctx.sessions.get(attempt.implementationSessionId);
    if (liveStatuses.has(session?.status ?? "")) return { decision: "active" as const, attempt };
    if (attempt.revisions.at(-1)?.reviews.at(-1)?.state === "started") return reconcileReview(ctx, attempt);
    if (
      !attempt.revisions.length ||
      session?.status === "disconnected" ||
      ["request_aborted", "worker_lost", "host_shutdown"].includes(session?.last_exit?.cause ?? "")
    )
      return reconcileImplementation(ctx, attempt, commandParams.expectedRun);
    return { decision: "unchanged" as const, attempt };
  });
};

export const reconcileAttemptCommand = defineCommand({
  id: "reconcile-attempt",
  title: "Reconcile managed attempt",
  cli: true,
  params: { workspaceId: params.text({ required: true }) },
  async run(ctx, input) {
    const result = await withWriteGuard(ctx, "attempt-launch", () => reconcileAttempt(ctx, input));
    return { ...result, attempt: await legacyAttemptOutput(ctx.storage, result.attempt) };
  },
});

export const listAttemptsCommand = defineCommand({
  id: "list-attempts",
  title: "List managed attempts",
  cli: true,
  params: {},
  async run(ctx, _commandParams) {
    return Promise.all((await listAttempts(ctx.storage)).map((attempt) => legacyAttemptOutput(ctx.storage, attempt)));
  },
});

export const listVariantsCommand = defineCommand({
  id: "list-variants",
  title: "List implementation variants",
  cli: true,
  async run(ctx) {
    return listAttempts(ctx.storage);
  },
});
