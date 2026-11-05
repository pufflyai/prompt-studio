import type { createSessionStreamTransport } from "./session-stream";

export const watchNativeDocument = (
  transport: ReturnType<typeof createSessionStreamTransport>,
  input: { projectId: string; documentKey: string; roomId: string; signal?: AbortSignal },
  onEvent: (event: string, data: unknown) => void,
) =>
  new Promise<void>((resolve, reject) => {
    let subscription: { close(): void } | undefined;
    let settled = false;
    const finish = (failure?: { error: unknown }) => {
      if (settled) return;
      settled = true;
      input.signal?.removeEventListener("abort", aborted);
      subscription?.close();
      if (failure) reject(failure.error);
      else resolve();
    };
    const aborted = () => finish();
    if (input.signal?.aborted) return resolve();
    input.signal?.addEventListener("abort", aborted, { once: true });
    subscription = transport.subscribe(
      {
        native_document: { project_id: input.projectId, document_key: input.documentKey, room_id: input.roomId },
      },
      {
        onEvent(event, data) {
          if (settled || input.signal?.aborted) return;
          try {
            if (event === "end") finish();
            else onEvent(event, data);
          } catch (error) {
            finish({ error });
          }
        },
        onError: (error) => finish({ error }),
      },
    );
    if (settled) subscription.close();
  });
