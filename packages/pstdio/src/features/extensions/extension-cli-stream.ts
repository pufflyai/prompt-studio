import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { ExtensionClient } from "@pstdio/sdk/client";

export const printExtensionCommandStream = async (input: {
  commandId: string;
  request: CommandExecuteRequest;
  stream: ExtensionClient["stream"];
  log: (line: string) => void;
}) => {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on("SIGINT", interrupt);
  try {
    for await (const event of input.stream(input.commandId, input.request, { signal: controller.signal })) {
      if (event.type === "data") input.log(JSON.stringify(event));
      else {
        input.log(JSON.stringify({ type: "end", outcome: event.response.outcome }));
        return event.response.outcome.ok ? 0 : 1;
      }
    }
    return controller.signal.aborted ? 130 : 1;
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
