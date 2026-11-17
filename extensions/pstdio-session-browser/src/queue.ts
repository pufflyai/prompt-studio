import type { ChatRendererAction, ExtensionSessionsApi } from "@pstdio/sdk/extensions";
import { selectedHarness } from "./selection";

type QueueAction = Extract<ChatRendererAction, { type: "queue" }>;
type QueueApi = Partial<
  Pick<
    ExtensionSessionsApi,
    | "updateQueuedFollowUp"
    | "followup"
    | "removeQueuedFollowUp"
    | "moveQueuedFollowUp"
    | "combineQueuedFollowUps"
    | "steerQueuedFollowUp"
  >
>;
export const queueAction = async (sessions: QueueApi, sessionId: string, action: QueueAction) => {
  const position = action.item.position;
  const revision = action.item.revision;
  if (position === undefined || !revision) throw new Error("Refresh the selected queued request before editing.");
  const harness = selectedHarness(action.values) ?? selectedHarness(action.item.values ?? {});
  switch (action.operation) {
    case "update":
      await sessions.updateQueuedFollowUp!(sessionId, position, {
        prompt: action.prompt ?? action.item.prompt,
        expectedRevision: revision,
        model: harness ? (harness.model ?? null) : action.item.model,
        params: harness ? (harness.params ?? {}) : action.item.params,
        attachments: action.attachments.map((file) => ({ file_id: file.id })),
      });
      break;
    case "create":
      await sessions.followup!({
        sessionId,
        prompt: action.prompt ?? action.item.prompt,
        harness,
        attachments: action.attachments.map((file) => ({ file_id: file.id })),
      });
      break;
    case "remove":
      await sessions.removeQueuedFollowUp!(sessionId, position, revision);
      break;
    case "move":
      await sessions.moveQueuedFollowUp!(sessionId, position, {
        direction: action.direction!,
        steps: action.steps,
        expectedRevision: revision,
      });
      break;
    case "combine":
      if (action.target?.position === undefined || !action.target.revision)
        throw new Error("Select the target queued request again.");
      await sessions.combineQueuedFollowUps!(sessionId, action.target.position, {
        sourcePosition: position,
        sourceRevision: revision,
        targetRevision: action.target.revision,
      });
      break;
    case "steer": {
      const runStartedAt = action.item.activeRunStartedAt;
      if (!runStartedAt) throw new Error("The active run changed. Refresh before steering.");
      const result = await sessions.steerQueuedFollowUp!(sessionId, position, {
        expectedRevision: revision,
        expectedRunStartedAt: runStartedAt,
      });
      if (result.status !== "accepted") throw new Error(result.message);
      break;
    }
  }
};
