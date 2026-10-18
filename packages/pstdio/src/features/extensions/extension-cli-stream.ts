import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { ExtensionClient } from "@pstdio/sdk/client";

export const printExtensionCommandStream = async (input: {
  commandId: string;
  request: CommandExecuteRequest;
  streamCommand: ExtensionClient["streamCommand"];
  log: (line: string) => void;
}) => {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on("SIGINT", interrupt);
  try {
    const { projectId, ...request } = input.request;
    const stream = input.streamCommand(projectId, input.commandId, request, { signal: controller.signal });
    for await (const data of stream) input.log(JSON.stringify({ type: "data", data }));
    const outcome = await stream.outcome;
    input.log(JSON.stringify({ type: "end", outcome }));
    if (controller.signal.aborted) return 130;
    return outcome.ok ? 0 : 1;
  } catch (error) {
    const code = controller.signal.aborted
      ? "command_stream_cancelled"
      : ((error as { code?: string })?.code ?? "command_stream_disconnected");
    input.log(
      JSON.stringify({
        type: "end",
        outcome: { ok: false, status: "error", code, reason: error instanceof Error ? error.message : String(error) },
      }),
    );
    return controller.signal.aborted ? 130 : 1;
  } finally {
    process.off("SIGINT", interrupt);
  }
};
