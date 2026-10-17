import { expect, test } from "bun:test";
import { createOpencodeHarness } from "./harness";
import { ctx } from "./harness.test-helpers";

test("final project retirement prevents reconnection after old-worker cleanup", async () => {
  const retiring = Promise.withResolvers<void>();
  const retired = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();
  let starts = 0;
  let failed = false;
  const harness = createOpencodeHarness(
    {},
    {
      isPortOpen: async () => false,
      pingServer: async () => false,
      startServer: async () => {
        starts += 1;
        if (starts === 1)
          return {
            url: "http://127.0.0.1:4096",
            dispose: async () => {
              retiring.resolve();
              await retired.promise;
            },
          };
        await ready.promise;
        return { url: "http://127.0.0.1:4097", dispose: async () => {} };
      },
      fetcher: async (url, init) => {
        if (new URL(String(url)).pathname === "/session" && !failed) {
          failed = true;
          throw Object.assign(new Error("connection failed"), { code: "ECONNREFUSED" });
        }
        if (new URL(String(url)).pathname === "/session") return Response.json({ id: "late" });
        return Response.json(init?.method === "POST" ? true : []);
      },
    },
  );
  await harness.getCommandState!(ctx, { cwd: "/tmp" });
  const starting = Promise.resolve(
    harness.start(ctx, {
      sessionId: "host-session",
      prompt: "work",
      cwd: "/tmp",
      events: { push() {}, getMessages: () => [] },
    }),
  ).catch((error: unknown) => error);
  await retiring.promise;
  const cleanup = harness.dispose!(ctx);
  try {
    await Bun.sleep(0);
    retired.resolve();
    await Bun.sleep(0);
    expect(starts).toBe(1);
  } finally {
    retired.resolve();
    ready.resolve();
    await Promise.allSettled([starting, cleanup]);
  }
});
