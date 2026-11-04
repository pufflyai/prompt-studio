import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { executeProjectExtensionCommand } from "../../features/extensions/execute-project-extension-command";

export const executeNativeDocumentCommand = async (
  deps: ExtensionsRouteDeps,
  input: Parameters<typeof executeProjectExtensionCommand>[1],
) => {
  const result = await executeProjectExtensionCommand(deps, input);
  // Native endpoints return document results, so the dashboard cannot forward command event IDs.
  if (input.body.source === "dashboard") {
    for (const eventId of result.eventIds)
      deps.eventBus.emit("extension_events", "set", { id: crypto.randomUUID(), projectId: input.projectId, eventId });
  }
  return result;
};
