import type {
  HarnessCommandContext,
  HarnessCommandDiscoveryContext,
  HarnessCommandState,
  HarnessOperation,
  PreparedHarnessOperation,
} from "@pstdio/sdk/extensions";
import type { createOpencodeService } from "./opencode-service";
import { pollOpencodeUntilIdle } from "./opencode-session-poller";

type Service = ReturnType<typeof createOpencodeService>;
export const opencodeCommandState = async (
  input: HarnessCommandDiscoveryContext,
  service: Service,
): Promise<HarnessCommandState> => ({
  slashCommands: true,
  modes: [],
  commands: [
    { name: "/compact", description: "Compact OpenCode's native conversation." },
    ...(await service.getCommands(input.cwd)),
  ],
});
export const prepareOpencodeOperation = (
  input: HarnessCommandContext,
  operation: HarnessOperation,
  service: Service,
): PreparedHarnessOperation => {
  if (operation.kind !== "command") throw new Error("OpenCode has no action for this mode.");
  if (!input.agentSessionId) throw new Error("Send a message before using native OpenCode commands.");
  const id = input.agentSessionId;
  return {
    execution: "exclusive",
    invoke: async ({ events, signal }) => {
      signal?.throwIfAborted();
      const stopNative = () => void service.abortSession(id, input.cwd).catch(() => {});
      signal?.addEventListener("abort", stopNative, { once: true });
      try {
        await service.runCommand({ sessionId: id, text: operation.text, model: input.model, cwd: input.cwd, signal });
      } finally {
        signal?.removeEventListener("abort", stopNative);
      }
      const abort = new AbortController();
      return {
        kind: "started",
        session: {
          agentSessionId: id,
          timeoutStrategy: "provider",
          done: pollOpencodeUntilIdle({
            loadMessages: service.getSessionMessages,
            sessionId: id,
            cwd: input.cwd,
            events,
            abortSignal: abort.signal,
          }),
          stop: async () => {
            abort.abort();
            await service.abortSession(id, input.cwd);
          },
        },
      };
    },
  };
};
