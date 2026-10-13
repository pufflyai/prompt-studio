import type { CommandContext } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { appendAttemptEvent, readAttempt } from "../data/attempt-storage";
import { readStackRepair } from "./update-stack";

export async function resumeStackRepair(
  ctx: CommandContext,
  workspaceId: string,
  beforeDispatch: (head?: string) => Promise<void>,
) {
  const attempt = await readAttempt(ctx.storage, workspaceId);
  const repair = attempt ? await readStackRepair(ctx, attempt) : null;
  if (!attempt || !repair) return { decision: "wait" as const, reason: "ticket-not-ready" };
  await beforeDispatch(repair.base.headSha);
  await ctx.sessions.followup({
    sessionId: attempt.implementationSessionId,
    prompt: [
      `Update the existing dependency stack for ${attempt.ticketShorthand} in this same workspace. Read the current ticket and outstanding findings.`,
      `Run pst pstdio-planner update-stack --workspace-id ${attempt.workspaceId} --implementation-session-id ${attempt.implementationSessionId} --expected-head-sha ${repair.headSha}. Resolve any integration conflicts without discarding this ticket's changes.`,
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
