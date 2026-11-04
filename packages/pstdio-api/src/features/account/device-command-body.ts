import type { Context, Next } from "hono";
import { deviceCommandInputLimit } from "pstdio-sync-contracts";
import type { AppBindings } from "../../types";

export const enforceDeviceCommandBodyLimit = async (c: Context<AppBindings>, next: Next) => {
  if (c.req.method !== "POST" || !c.req.raw.body) return next();
  const chunks: Uint8Array[] = [];
  const reader = c.req.raw.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > deviceCommandInputLimit) {
        await reader.cancel();
        return c.json({ error: "The complete remote action must fit within 64 MiB." }, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  c.req.raw = new Request(c.req.raw, {
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  });
  return next();
};
