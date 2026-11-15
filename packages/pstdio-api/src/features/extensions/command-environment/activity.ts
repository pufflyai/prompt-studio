import type { CommandSource } from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import { createResourceActivityApi } from "../../activity/resource-activity-api";
import type { ExtensionsRouteDeps } from "../deps";
import type { EnabledSource } from "./types";

export const createActivityApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; enabledSource: EnabledSource; source?: CommandSource },
): CommandRunnerEnvironment["activity"] => ({
  ...createResourceActivityApi(deps, {
    projectId: input.projectId,
    userInitiated: input.source === "dashboard" || input.source === "command-panel",
    extensionId: input.enabledSource.installedSource.extension_id,
  }),
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
