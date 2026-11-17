/** A deadline between useful network progress, never a limit on the whole transfer. */
export class RelayInactivityError extends Error {
  constructor() {
    super("Cloud request made no progress; retrying this source");
  }
}

export const fetchWithInactivity = async (
  url: URL,
  init: RequestInit,
  input: {
    signal: AbortSignal;
    inactivityMs: number;
    progress?: (bytes: number) => void;
    uploading?: boolean;
  },
) => {
  const controller = new AbortController();
  const signal = AbortSignal.any([input.signal, controller.signal]);
  let timer: ReturnType<typeof setTimeout>;
  const progress = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(new RelayInactivityError()), input.inactivityMs);
  };
  // Fetch exposes no network upload progress. Only a response can confirm outgoing bytes.
  if (!input.uploading) progress();
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (error) {
    clearTimeout(timer!);
    throw signal.aborted ? signal.reason : error;
  }
  if (!response.body) {
    clearTimeout(timer!);
    return response;
  }
  progress();
  const reader = response.body.getReader();
  let finished = false;
  const dispose = () => {
    finished = true;
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  };
  let stream: ReadableStreamDefaultController<Uint8Array>;
  const abort = () => {
    if (finished) return;
    dispose();
    // Drain cancellation before rejecting consumers, so a retry cannot leave its body running.
    void reader
      .cancel(signal.reason)
      .catch(() => {})
      .then(() => stream.error(signal.reason));
  };
  const body = new ReadableStream<Uint8Array>(
    {
      start(value) {
        stream = value;
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      },
      async pull(value) {
        try {
          const chunk = await reader.read();
          if (finished) return;
          if (chunk.done) {
            dispose();
            value.close();
          } else {
            if (chunk.value.byteLength) {
              progress();
              input.progress?.(chunk.value.byteLength);
            }
            value.enqueue(chunk.value);
          }
        } catch (error) {
          if (finished) return;
          dispose();
          value.error(signal.aborted ? signal.reason : error);
        }
      },
      async cancel(reason) {
        dispose();
        await reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
};
