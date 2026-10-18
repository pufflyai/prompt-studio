import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { readAttempt } from "../data/attempt-storage";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor, saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { resolveImplementationBase } from "../data/implementation-targets";
import { withWriteGuard } from "../data/write-guard";
import { resumeAutoBuildAttempt } from "./auto-build-resume";
import { resumeStackRepair } from "./auto-build-stack";
import type { NextTicket } from "./next-ticket-types";
import { readNextTickets } from "./next-tickets";
import { startAttempt } from "./run-attempt";

async function dispatchNext(
  ctx: CommandContext,
  candidate: NextTicket,
  beforeDispatch: (head?: string) => Promise<void>,
  input: { base?: string; workspaceId?: string },
) {
  if (candidate.action !== "start" && candidate.action !== "recover-workspace" && (input.base || input.workspaceId))
    throw new Error(
      "Existing attempts keep their workspace and base. Dispatch without overrides, then use update-stack to change the base.",
    );
  if (candidate.action === "resume") return resumeAutoBuildAttempt(ctx, candidate.id, beforeDispatch);
  if (candidate.action === "update-stack" && candidate.workspaceId)
    return resumeStackRepair(ctx, candidate.workspaceId, beforeDispatch);
  if (candidate.action === "recover-workspace") {
    if (input.workspaceId) throw new Error("Recovery creates a fresh managed workspace. Omit workspace-id.");
    const previous = await readAttempt(ctx.storage, candidate.workspaceId!);
    if (!previous || !candidate.recoveryHeadSha) throw new Error("The recovery attempt changed. Query again.");
    const started = await startAttempt(
      ctx,
      {
        ticket: candidate.id,
        workspace: {
          providerId: "pstdio.worktree",
          params: { base: candidate.recoveryBaseSha ?? previous.base.headSha },
        },
      },
      {
        beforeDispatch,
        dependencyReview: (await readAutoBuildMode(ctx)).blockOnReview ? "approved" : "submitted",
        recovery: { previous, headSha: candidate.recoveryHeadSha, detail: candidate.detail ?? "Workspace unavailable" },
      },
    );
    return {
      decision: "started" as const,
      ticket: candidate.ticket,
      workspaceId: started.workspace.id,
      sessionId: started.session.id,
    };
  }
  const base = input.base ?? (await resolveImplementationBase(ctx, await ctx.settings.all()));
  const mode = await readAutoBuildMode(ctx);
  const started = await startAttempt(
    ctx,
    { ticket: candidate.id, ...(base ? { workspace: { providerId: "pstdio.worktree", params: { base } } } : {}) },
    { beforeDispatch, workspaceId: input.workspaceId, dependencyReview: mode.blockOnReview ? "approved" : "submitted" },
  );
  return {
    decision: "started" as const,
    ticket: candidate.ticket,
    workspaceId: started.workspace.id,
    sessionId: started.session.id,
  };
}

export const autoBuildDispatchCommand = defineCommand({
  id: "auto-build.dispatch",
  title: "Dispatch an Auto Build ticket",
  cli: true,
  mutating: true,
  params: {
    ticket: params.text({ required: true }),
    revision: params.text({ required: true }),
    base: params.text({ label: "Root target branch" }),
    workspaceId: params.text({ label: "Existing ticket workspace" }),
  },
  async run(ctx, { ticket, revision, ...input }) {
    return withWriteGuard(ctx, "attempt-launch", async () => {
      const mode = await readAutoBuildMode(ctx);
      if (!mode.enabled || mode.revision !== revision)
        return { decision: "wait" as const, reason: "auto-build-stopped" };
      const { tickets: candidates, capacity, snapshot } = await readNextTickets(ctx, mode, { base: input.base });
      const candidate = candidates.find((row) => row.id === ticket || row.ticket === ticket);
      if (!candidate)
        return {
          decision: "wait" as const,
          reason: capacity.running >= capacity.limit ? "capacity-full" : "ticket-not-ready",
        };
      const beforeDispatch = async (baseHeadSha?: string) => {
        const current = await readAutoBuildMode(ctx);
        if (!current.enabled || current.revision !== revision) {
          throw new Error("Auto Build stopped or the ticket is no longer ready.");
        }
        const next = await readNextTickets(ctx, current, { base: input.base });
        const latest = next.tickets.find(({ id }) => id === candidate.id);
        if (!latest || latest.action !== candidate.action || latest.workspaceId !== candidate.workspaceId)
          throw new Error("Auto Build stopped or the ticket is no longer ready.");
        if (baseHeadSha && latest.baseHeadSha !== baseHeadSha)
          throw new Error("The dependency revision changed. Read candidates again before dispatching.");
        if (next.snapshot !== snapshot) throw new Error("Work changed before dispatch. Read tickets next again.");
      };
      const result = await dispatchNext(ctx, candidate, beforeDispatch, input);
      if (result.decision === "started") {
        // The supervisor already knows about work it dispatched.
        await withWriteGuard(
          ctx,
          "auto-build-supervisor",
          async () => {
            const supervisor = await readAutoBuildSupervisor(ctx);
            const current = await readAutoBuildMode(ctx);
            if (!supervisor.sessionId || current.revision !== revision) return;
            const { snapshot } = await readNextTickets(ctx, current);
            await saveAutoBuildSupervisor(ctx, { ...supervisor, lastWake: snapshot });
          },
          () => undefined,
        );
      }
      return result;
    });
  },
});
