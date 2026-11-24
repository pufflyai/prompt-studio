import type { SessionSteeringInput } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { buildFollowUpPrompt } from "./follow-up-prompt";
import { captureActiveSteering, rejectQueuedSteering } from "./queued-steering-target";
import { resolveMessageSender } from "./session-message-sender";
import { deliverSteering } from "./steering-delivery";

export const steerSession = async (deps: SessionsRouteDeps, sessionId: string, input: SessionSteeringInput) => {
  const prompt = await buildFollowUpPrompt(
    {
      prompt: input.prompt,
      summary_from_session_id: input.summaryFromSessionId,
      summary_format: input.summaryFormat,
      summary_role: input.summaryRole,
    },
    deps,
  );
  if (!prompt.trim())
    return rejectQueuedSteering("delivery_failed", "The prompt and source session summary are empty.");
  const attachmentRefs = input.attachments?.map(({ fileId }) => ({ file_id: fileId })) ?? [];
  return deliverSteering(deps, sessionId, input.expectedRunStartedAt, async () => {
    const target = await captureActiveSteering(deps, sessionId, input);
    if (target.outcome !== undefined) return target;
    const { projectId, owner, runtime, steer, settings } = target;
    const sender = await resolveMessageSender(deps, projectId, input.source);
    return {
      outcome: undefined,
      projectId,
      owner,
      runtime,
      steer,
      attachmentRefs,
      claim: (delivery) =>
        deps.sessionQueueEntriesService.createSteeringDelivery(
          {
            session_id: sessionId,
            request_kind: "follow_up",
            prompt,
            sender_json: sender,
            model: settings.model ?? null,
            params_json: settings.params,
            attachments_json: attachmentRefs,
          },
          delivery,
        ),
      // A new --steer request has no next-turn intent to restore on definite rejection.
      reject: (entry) => deps.sessionQueueEntriesService.remove(entry.queue_position),
    };
  });
};
