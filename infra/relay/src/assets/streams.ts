export interface PartInput {
  sha256: string;
  byteLength: number;
  body: ReadableStream<Uint8Array>;
  signal?: AbortSignal;
}

export async function* checkedBytes(
  body: ReadableStream<Uint8Array>,
  expected: { sha256?: string; byteLength: number },
  signal?: AbortSignal,
) {
  const reader = body.getReader();
  const hash = expected.sha256 ? new Bun.CryptoHasher("sha256") : undefined;
  let length = 0;
  const abort = () => void reader.cancel(signal?.reason).catch(() => {});
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > expected.byteLength) throw new Error("Asset length mismatch");
      hash?.update(chunk.value);
      yield chunk.value;
    }
    if (length !== expected.byteLength || (hash && hash.digest("hex") !== expected.sha256))
      throw new Error("Asset digest or length mismatch");
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export const multipartSize = (byteLength: number) => {
  const minimum = 5 * 1024 * 1024;
  const size = Math.max(minimum, Math.ceil(byteLength / 10_000 / minimum) * minimum);
  if (!Number.isSafeInteger(byteLength) || size > 5 * 1024 ** 3)
    throw new Error("Asset exceeds the S3 multipart range");
  return size;
};

export const checkedStream = (
  body: ReadableStream<Uint8Array>,
  expected: { sha256?: string; byteLength: number },
  signal?: AbortSignal,
) => {
  const controller = new AbortController();
  const bytes = checkedBytes(body, expected, signal ? AbortSignal.any([signal, controller.signal]) : controller.signal);
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const chunk = await bytes.next();
        if (chunk.done) controller.close();
        else controller.enqueue(chunk.value);
      },
      async cancel(reason) {
        controller.abort(reason);
        await bytes.return();
        await body.cancel(reason).catch(() => {});
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: 64 * 1024 }),
  );
};
