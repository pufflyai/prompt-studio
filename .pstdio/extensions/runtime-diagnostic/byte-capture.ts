import { setTimeout as delay } from "node:timers/promises";

const captureOwner = Symbol.for("pstdio.runtime-diagnostic.byte-capture");

// Buffer is shared by every project and loaded copy of this extension in the process.
const sharedBuffer = Buffer as typeof Buffer & { [captureOwner]?: typeof Buffer.from };

export const startByteCapture = () => {
  if (sharedBuffer[captureOwner]) throw new Error("A backend byte capture is already running");
  const original = Buffer.from;
  const contentMarker = Buffer.from("content");
  let calls = 0;
  let bytes = 0;
  const large: { bytes: number; stack?: string; transcript: boolean }[] = [];
  const sizes = new Map<number, { count: number; transcript: boolean }>();
  const from = function (this: typeof Buffer, ...args: unknown[]) {
    const result = Reflect.apply(original, this, args) as Buffer;
    const [value, encoding] = args;
    if (typeof value === "string" && encoding === "hex") {
      const size = result.length;
      calls++;
      bytes += size;
      if (size > 100_000) {
        const transcript = result.subarray(0, 256).includes(contentMarker);
        const previous = sizes.get(size);
        sizes.set(size, { count: (previous?.count ?? 0) + 1, transcript });
        if (large.length < 25) large.push({ bytes: size, stack: new Error().stack, transcript });
      }
    }
    return result;
  } as typeof original;
  sharedBuffer[captureOwner] = from;
  Buffer.from = from;

  return () => {
    // A prior command can finish file persistence after another capture has started.
    if (sharedBuffer[captureOwner] === from) {
      Buffer.from = original;
      delete sharedBuffer[captureOwner];
    }
    return { pid: process.pid, calls, bytes, large, sizes: [...sizes] };
  };
};

export const captureBytes = async (durationMs: number, signal?: AbortSignal) => {
  const finish = startByteCapture();
  try {
    await delay(durationMs, undefined, { signal });
    return finish();
  } finally {
    finish();
  }
};
