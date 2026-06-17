import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import type { EnabledSource } from "./types";

export const createActivityApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; enabledSource: EnabledSource },
): CommandRunnerEnvironment["activity"] => ({
  record: async (activity) => {
    const target = activity.target ?? { type: "extension", id: input.enabledSource.instance.id };
    const event = await deps.activityEventsService.create({
      projectId: input.projectId,
      resourceType: target.type,
      resourceId: target.id,
      sourceExtensionId: input.enabledSource.installedSource.id,
      eventType: "extension.command",
      actorType: "system",
      source: "api",
      summary: activity.message,
      payloadJson: { related: activity.related ?? [], metadata: activity.metadata ?? {} },
    });
    return { id: event.id };
  },
});
