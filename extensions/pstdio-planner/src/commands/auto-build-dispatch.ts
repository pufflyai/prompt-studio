import { defineCommand, params } from "@pstdio/sdk/extensions";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { resolveImplementationBase } from "../data/implementation-targets";
import { withWriteGuard } from "../data/write-guard";
import { readAutoBuildCandidates } from "./auto-build-candidates";
import { resumeAutoBuildAttempt } from "./auto-build-resume";
import { startAttempt } from "./run-attempt";

export const autoBuildDispatchCommand = defineCommand({
  id: "auto-build.dispatch",
  title: "Dispatch an Auto Build ticket",
  cli: true,
  mutating: true,
  params: { ticket: params.text({ required: true }), revision: params.text({ required: true }) },
  async run(ctx, { ticket, revision }) {
    return withWriteGuard(ctx, "attempt-launch", async () => {
      const mode = await readAutoBuildMode(ctx);
      if (!mode.enabled || mode.revision !== revision)
        return { decision: "wait" as const, reason: "auto-build-stopped" };
      const { candidates, capacity } = await readAutoBuildCandidates(ctx, mode);
      const candidate = candidates.find((row) => row.id === ticket || row.ticket === ticket);
      if (!candidate)
        return {
          decision: "wait" as const,
          reason: capacity.running >= capacity.limit ? "capacity-full" : "ticket-not-ready",
        };
      const beforeDispatch = async () => {
        const current = await readAutoBuildMode(ctx);
        if (
          !current.enabled ||
          current.revision !== revision ||
          !(await readAutoBuildCandidates(ctx, current)).candidates.some(({ id }) => id === candidate.id)
        ) {
          throw new Error("Auto Build stopped or the ticket is no longer ready.");
        }
      };
      if (candidate.action === "resume") return resumeAutoBuildAttempt(ctx, candidate.id, beforeDispatch);
      const base = await resolveImplementationBase(ctx, await ctx.settings.all());
      const result = await startAttempt(
        ctx,
        { ticket: candidate.id, ...(base ? { workspace: { providerId: "pstdio.worktree", params: { base } } } : {}) },
        beforeDispatch,
      );
      return {
        decision: "started" as const,
        ticket: candidate.ticket,
        workspaceId: result.workspace.id,
        sessionId: result.session.id,
      };
    });
  },
});
