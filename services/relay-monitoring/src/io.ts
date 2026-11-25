import { readFile } from "node:fs/promises";
import { z } from "zod";

export const readBounded = async (
  body: ReadableStream<Uint8Array> | null,
  maximum = 2 * 1024 ** 2,
  signal?: AbortSignal,
) => {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const part = await reader.read();
      signal?.throwIfAborted();
      if (part.done) break;
      length += part.value.length;
      if (length > maximum) throw new Error("Monitoring response exceeds its limit");
      chunks.push(part.value);
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};
export const readJson = async <T>(path: string, schema: z.ZodType<T>) => {
  try {
    return schema.parse(JSON.parse(process.env.MONITORING_CONFIG_JSON ?? (await readFile(path, "utf8"))));
  } catch {
    throw new Error("Monitoring configuration is missing or invalid");
  }
};
export const environmentSchema = z.enum(["production", "development", "test"]);
export const addressSchema = z.url().refine((input) => ["http:", "https:"].includes(new URL(input).protocol));

/** Single-flight scheduled work. Shutdown cancels and awaits this owner's current operation only. */
export const schedule = (run: (signal: AbortSignal) => Promise<void>, intervalMs: number) => {
  const controller = new AbortController();
  let active: Promise<void> | undefined;
  const tick = () => {
    active ??= run(AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]))
      .catch(() => {})
      .finally(() => {
        active = undefined;
      });
  };
  const timer = setInterval(tick, intervalMs);
  tick();
  return async () => {
    clearInterval(timer);
    controller.abort();
    await active;
  };
};
export const onShutdown = (close: () => Promise<void>) => {
  let closing = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      void close().catch(() => {
        console.error("Monitoring shutdown failed");
        process.exitCode = 1;
      });
    });
};
