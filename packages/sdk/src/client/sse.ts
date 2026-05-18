export type SseEvent = {
  event: string;
  data: string;
};

export const parseSseEvent = (part: string) => {
  let event = "message";
  const data: string[] = [];

  for (const line of part.split("\n")) {
    if (line.startsWith("event: ")) {
      event = line.slice(7);
      continue;
    }

    if (line.startsWith("data: ")) {
      data.push(line.slice(6));
    }
  }

  if (!event || data.length === 0) return null;
  return { event, data: data.join("\n") };
};

export const consumeSseBuffer = (buffer: string) => {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  const events = parts.map((part) => parseSseEvent(part)).filter((event): event is SseEvent => event !== null);

  return { remainder, events };
};

export const readSseStream = async (
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void,
  options: { signal?: AbortSignal } = {},
) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const abort = () => {
    void reader.cancel();
  };

  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    while (!options.signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { remainder, events } = consumeSseBuffer(buffer);
      buffer = remainder;

      for (const event of events) {
        onEvent(event);
      }
    }
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
};
