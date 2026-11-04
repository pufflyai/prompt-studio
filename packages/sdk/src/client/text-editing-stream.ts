import type { TextEditingError, TextEditingEvent } from "pstdio-api-contracts/extension-kernel";
import type { createSessionStreamTransport } from "./session-stream";
import { textEditingException } from "./text-editing-error";

export const watchTextConnection = (
  transport: ReturnType<typeof createSessionStreamTransport>,
  address: { project_id: string; token: string },
  input: { signal: AbortSignal; onEvent: (event: TextEditingEvent) => void },
) =>
  new Promise<void>((resolve, reject) => {
    let subscription: { close(): void } | undefined;
    let settled = false;
    const finish = (failure?: { error: unknown }) => {
      if (settled) return;
      settled = true;
      input.signal.removeEventListener("abort", aborted);
      subscription?.close();
      if (failure) reject(failure.error);
      else resolve();
    };
    const aborted = () => finish();
    if (input.signal.aborted) return resolve();
    input.signal.addEventListener("abort", aborted, { once: true });
    subscription = transport.subscribe(
      { text_editing: address },
      {
        onEvent(event, data) {
          if (settled || input.signal.aborted) return;
          try {
            if (event === "text") input.onEvent(data as TextEditingEvent);
            if (event === "text_error") finish({ error: textEditingException(data as TextEditingError) });
            if (event === "end") finish();
          } catch (error) {
            finish({ error });
          }
        },
        onError: (error) => finish({ error }),
      },
    );
    if (settled) subscription.close();
  });
