import type { CommandExecuteBody } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../services/extension-service";
import type { SessionEventSink } from "../sessions/session-stream-connections";
import type { ExtensionsRouteDeps } from "./deps";
import { executeProjectExtensionCommand } from "./execute-project-extension-command";

export const prepareCommandSubscription = async (
  deps: ExtensionsRouteDeps,
  command: { project_id: string; command_id: string; body: CommandExecuteBody },
) => {
  const { project_id: projectId, command_id: commandId, body } = command;
  try {
    const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
    const record = snapshot.runtime.commands.find((item) => item.id === commandId);
    if (!record) return { error: `Command not found: ${commandId}`, code: "command_not_found", status: 404 as const };
    if (!record.stream)
      return { error: "Command does not declare a stream", code: "command_not_streamable", status: 409 as const };
    if (body.workspaceId) {
      const workspace = await deps.workspaceService.get(body.workspaceId);
      if (!workspace || workspace.project_id !== projectId)
        return { error: "Workspace not found", code: "workspace_not_found", status: 404 as const };
    }
  } catch (error) {
    if (error instanceof ProjectNotFoundError)
      return { error: error.message, code: "project_not_found", status: 404 as const };
    throw error;
  }
  return {
    async run(sink: SessionEventSink) {
      const controller = new AbortController();
      sink.onAbort(() => controller.abort());
      if (sink.aborted) controller.abort();
      try {
        const response = await executeProjectExtensionCommand(deps, {
          projectId,
          commandId,
          body,
          signal: controller.signal,
          onChunk: (chunk) => sink.write("chunk", chunk),
        });
        await sink.write("end", response);
      } catch (error) {
        await sink.write("error", {
          message: error instanceof Error ? error.message : String(error),
          code: controller.signal.aborted ? "command_stream_cancelled" : "command_stream_failed",
        });
      }
    },
  };
};
