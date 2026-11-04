import type { TextEditingEvent, TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "../extensions/guest-host";
import { textEditingError, textEditingFailure } from "../extensions/text-editing-codec";
import type { TextEditingConnection } from "./text-editing";
import { createTextGuestMembers } from "./text-editing-members";

/** Same public SDK host for authenticated clients and native presentations. The token stays in this closure. */
export const createTextConnectionGuest = (
  connection: TextEditingConnection,
  lease = { generation: () => 0, closed: () => false, ensure: async () => {} },
) => {
  const listeners = new Set<(event: TextEditingEvent) => void>();
  const members = createTextGuestMembers(connection, lease.generation);
  const abort = new AbortController();
  let stopped = false;
  let closing: Promise<void> | undefined;
  const emit = (event: TextEditingEvent) => {
    for (const listener of listeners) listener(event);
  };
  const host: GuestHost = {
    call: async (method, ...args) => {
      if (stopped || lease.closed()) throw textEditingFailure("session_closed", "This text guest was disposed");
      if (method !== "editing.text") throw new Error("This connection provides editing.text only");
      return (await members.request(args[0] as TextEditingRequest)) as never;
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
    for (const [memberId, member] of members.entries())
      emit({
        type: "error",
        memberId,
        handle: member.handle,
        error: textEditingError(error),
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
        if (lease.closed()) {
          stopped = true;
          abort.abort();
          failed(textEditingFailure("session_closed", "This text connection was disposed"));
          return;
        }
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
  const cancelClose = (error: unknown) => {
    const failure = textEditingError(error);
    if (!failure.cancelledBarrierId) return;
    for (const [memberId, member] of members.entries())
      emit({ type: "error", memberId, handle: member.handle, barrierId: failure.cancelledBarrierId, error: failure });
  };
  const close = async () => {
    if (!stopped && !lease.closed()) {
      try {
        try {
          await lease.ensure();
        } catch (error) {
          if (textEditingError(error).code !== "connection_reset") throw error;
        }
        await members.registerAll();
        await connection.prepareClose();
      } catch (error) {
        cancelClose(error);
        throw error;
      }
    }
    stopped = true;
    abort.abort();
    await watching;
    listeners.clear();
    await connection.disconnect();
  };
  return {
    host,
    close() {
      closing ??= close().catch((error) => {
        closing = undefined;
        throw error;
      });
      return closing;
    },
  };
};
