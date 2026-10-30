import type { TextEditingEvent, TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "../extensions/guest-host";
import type { TextEditingConnection } from "./text-editing";

/** Same public SDK host for authenticated clients and native presentations. The token stays in this closure. */
export const createTextConnectionGuest = (connection: TextEditingConnection) => {
  const listeners = new Set<(event: TextEditingEvent) => void>();
  const members = new Map<string, string>();
  const abort = new AbortController();
  let stopped = false;
  const emit = (event: TextEditingEvent) => {
    for (const listener of listeners) listener(event);
  };
  const host: GuestHost = {
    call: async (method, ...args) => {
      if (method !== "editing.text") throw new Error("This connection provides editing.text only");
      const input = args[0] as TextEditingRequest;
      if (input.operation === "register") members.set(input.memberId, "");
      const result = await connection.request(input);
      if (input.operation === "open") members.set(input.memberId, (result as { handle: string }).handle);
      if (input.operation === "abandon") members.delete(input.memberId);
      if (input.operation === "close")
        for (const [id, handle] of members) if (handle === input.handle) members.delete(id);
      return result as never;
    },
    onEvent(scope, listener) {
      if (scope !== "editing.text") throw new Error("Unknown text event scope");
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const failed = (error: unknown) => {
    for (const [memberId, handle] of members)
      emit({
        type: "error",
        memberId,
        handle,
        error: {
          code: "source_unavailable",
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      });
  };
  const watching = (async () => {
    while (!stopped) {
      try {
        await connection.watch({ signal: abort.signal, onEvent: emit });
        if (stopped) return;
        throw new Error("Text connection ended");
      } catch (error) {
        if (stopped) return;
        failed(error);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(done, 1000);
          function done() {
            clearTimeout(timer);
            abort.signal.removeEventListener("abort", done);
            resolve();
          }
          abort.signal.addEventListener("abort", done, { once: true });
        });
      }
    }
  })();
  return {
    host,
    async close() {
      await connection.prepareClose();
      stopped = true;
      abort.abort();
      await watching;
      listeners.clear();
      await connection.disconnect();
    },
  };
};
