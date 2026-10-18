import type { CommandContext } from "@pstdio/sdk/extensions";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { readAttempt } from "../data/attempt-storage";
import { autoBuildDispatches } from "../data/auto-build-dispatches";
import { type AutoBuildMode, pauseAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { ticketsCollection } from "../data/collections";
import { withWriteGuard } from "../data/write-guard";
import { supervisorWakePrompt } from "./auto-build-prompts";
import { isLiveSession } from "./auto-build-sessions";

const timestamp = (value: string | null | undefined) => (value ? Date.parse(value) : 0);

export async function checkAutoBuildProgress(ctx: CommandContext) {
  const mode = await ctx.storage.get<AutoBuildMode>("auto-build");
  if (!mode?.enabled || !mode.prompt) return;
  return withWriteGuard(
    ctx,
    "auto-build-supervisor",
    async () => {
      const supervisor = await readAutoBuildSupervisor(ctx);
      if (!supervisor.sessionId) return;
      const session = await ctx.sessions.get(supervisor.sessionId);
      if (!session || isLiveSession(session)) return;
      const expectedRun = {
        status: session.status,
        startedAt: session.lastRequestStarted,
        endedAt: session.lastRequestEnded,
      };
      const lastPromptAt = timestamp(session.lastRequestStarted);
      const dispatches = await autoBuildDispatches(ctx, session.id).list();
      const retired = dispatches.length ? await readRetiredWorkspaceIds(ctx.storage) : new Set<string>();
      const progress = await Promise.all(
        dispatches.map(async ({ workspaceId, dispatchedAt }) => {
          if (retired.has(workspaceId)) return;
          const attempt = await readAttempt(ctx.storage, workspaceId);
          if (!attempt) return;
          const [ticket, worker] = await Promise.all([
            ticketsCollection(ctx.storage).get(attempt.ticketId),
            ctx.sessions.get(attempt.implementationSessionId),
          ]);
          if (!ticket || ticket.archived) return;
          const updatedAt = Math.max(
            timestamp(ticket.updatedAt),
            timestamp(attempt.updatedAt),
            timestamp(worker?.updatedAt),
          );
          return {
            updatedAt: Math.max(updatedAt, timestamp(dispatchedAt)),
            changed: updatedAt > Math.max(lastPromptAt, timestamp(dispatchedAt)),
            active: isLiveSession(worker),
          };
        }),
      );
      const progressAt = Math.max(lastPromptAt, ...progress.map((work) => work?.updatedAt ?? 0));
      const stalled = progress.some((work) => work?.active) && Date.now() - progressAt >= 60 * 60 * 1000;
      if (!stalled && session.status !== "failed" && !progress.some((work) => work?.changed)) return;
      const current = await ctx.storage.get<AutoBuildMode>("auto-build");
      if (!current?.enabled || current.revision !== mode.revision) return;
      try {
        await ctx.sessions.followup({
          sessionId: session.id,
          expectedRun,
          prompt: supervisorWakePrompt({ stalled, refreshScope: supervisor.scope?.revision !== mode.revision }),
        });
      } catch (error) {
        const latest = await ctx.sessions.get(session.id);
        if (
          latest &&
          latest.status !== "failed" &&
          (latest.status !== expectedRun.status ||
            latest.lastRequestStarted !== expectedRun.startedAt ||
            latest.lastRequestEnded !== expectedRun.endedAt)
        )
          return;
        await pauseAutoBuildMode(ctx, mode);
        throw error;
      }
    },
    () => undefined,
  );
}
