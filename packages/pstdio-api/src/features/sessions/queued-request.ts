import type { UpdateQueuedFollowUpInput } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { HarnessParamError, resolveHarnessRunParams } from "./harness-params";
import { requireHarnessAttachmentSupport, resolveSessionAttachments } from "./session-attachments";
import type { PendingQueueEntry } from "./session-scheduler-internals";

export const queuedRequest = (entry: PendingQueueEntry) => ({
  queuePosition: entry.queue_position,
  revision: entry.revision,
  prompt: entry.prompt,
  steeringDelivery: entry.steering_delivery_json,
  model: entry.model,
  params: entry.params_json ?? {},
  attachments: entry.attachments_json ?? [],
});

export const validateQueuedRequestEdit = async (
  deps: SessionsRouteDeps,
  sessionId: string,
  entry: PendingQueueEntry,
  input: UpdateQueuedFollowUpInput,
) => {
  const session = await deps.sessionService.get(sessionId);
  if (!session?.project_id || !session.agent) throw new HarnessParamError("Session has no harness.");
  const model = input.model === undefined ? entry.model : input.model;
  let params = entry.params_json ?? {};
  if (input.model !== undefined || input.params !== undefined) {
    const harness = await deps.harnessRegistry.get(session.agent, { projectId: session.project_id });
    if (!harness) throw new HarnessParamError("Session harness is unavailable.");
    if (
      model &&
      !(await harness.listModels({ projectId: session.project_id })).some((candidate) => candidate.id === model)
    )
      throw new HarnessParamError("Choose a supported model.");
    params =
      (await resolveHarnessRunParams(deps, {
        projectId: session.project_id,
        agentId: session.agent,
        model: model ?? undefined,
        overrides: input.params === null ? undefined : (input.params ?? params),
      })) ?? {};
  }
  const attachments = input.attachments ?? entry.attachments_json ?? [];
  await requireHarnessAttachmentSupport(deps, { projectId: session.project_id, agentId: session.agent, attachments });
  await resolveSessionAttachments(deps, session.project_id, attachments);
  return { prompt: input.prompt, model, params_json: params, attachments_json: attachments };
};
