import type { CommandContext } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { appendAttemptEvent, readAttempt } from "../data/attempt-storage";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { readStackRepair } from "./update-stack";

export async function resumeStackRepair(
  ctx: CommandContext,
  workspaceId: string,
  beforeDispatch: (head?: string) => Promise<void>,
) {
  const attempt = await readAttempt(ctx.storage, workspaceId);
  const repair = attempt ? await readStackRepair(ctx, attempt, await readAutoBuildMode(ctx)) : null;
  if (!attempt || !repair) return { decision: "wait" as const, reason: "ticket-not-ready" };
  await beforeDispatch(repair.base.headSha);
  await ctx.sessions.followup({
    sessionId: attempt.implementationSessionId,
    expectedRun: repair.expectedRun,
    prompt: [
      `Update the existing dependency stack for ${attempt.ticketShorthand} in this same workspace. Read the current implement-ticket skill, ticket, attempt history, and outstanding findings. Done status and confirmed answers do not prove dependency integration. Combining dependency revisions does not approve work or merge the target branch.`,
      `Run pst pstdio-planner update-stack --workspace-id ${attempt.workspaceId} --implementation-session-id ${attempt.implementationSessionId} --expected-head-sha ${repair.headSha}. Reconcile Git conflicts yourself, preserving the required behavior from both sides and this ticket's changes. Commit the resolution and retry. Do not request human review for code conflicts; ask only when features, concepts, requirements, plans, or architecture conflict and the instructions cannot decide the intended behavior.`,
      `Run the affected validation and configured adversarial review, save a new change request report, and submit the resulting HEAD with --expected-revision ${attempt.revisions.at(-1)?.revision ?? 0}. A prior review stays attached to its old commit; do not reopen it or launch a mandatory extra managed review.`,
      `If a human decision is required, use request-human for ${attempt.ticketShorthand} with --workspace-id ${attempt.workspaceId} and --session-id ${attempt.implementationSessionId}. Omit --expected-attempt-state; stack repair does not reopen an implementation phase. Read saved answers before continuing.`,
      "Keep ticket progress current using the project's configured statuses. Preserve its branch and PR target rules. Complete required CI on the latest pushed head. Request human input only for a decision you cannot resolve from the existing requirements.",
    ].join("\n\n"),
  });
  await appendAttemptEvent(ctx.storage, {
    id: repair.eventId,
    workspaceId: attempt.workspaceId,
    revision: attempt.revisions.at(-1)?.revision ?? null,
    type: "implementation_resumed",
    actor: actorFromSource(ctx.source, ctx.invocationId),
    sessionId: attempt.implementationSessionId,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: repair.headSha,
    metadata: { reason: "stack-update", baseSha: repair.base.headSha },
  });
  return { decision: "started" as const, workspaceId: attempt.workspaceId, sessionId: attempt.implementationSessionId };
}
