import type { SessionsRouteDeps } from "./deps";
import { validateRecoveredQuestionReply } from "./live-question-reply";
import { type DispatchContext, insertAbortAwareFollowUp, prepareExistingDispatch } from "./session-scheduler-internals";
import type { ActiveSession } from "./session-store";

export const reserveQuestionDispatch = async (
  deps: SessionsRouteDeps,
  context: DispatchContext,
  live: ActiveSession | null,
) => {
  const { session, signal, questionResponse } = context;
  signal?.throwIfAborted();
  await validateRecoveredQuestionReply(deps, session.id, session.status, live, questionResponse!);
  // Preserve question delivery under the legacy session limit. An ended run still needs a new workspace slot.
  if (context.respectCapacity && session.status !== "in_progress" && session.status !== "awaiting_input") {
    const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(session.id);
    if (!(await deps.workspaceCapacityService.hasCapacity(workspace?.id)))
      return insertAbortAwareFollowUp(deps, context, true);
  }
  return prepareExistingDispatch(deps, context);
};
