import { expect, test } from "bun:test";
import { createOpencodeHarness } from "./harness";
import { ctx } from "./harness.test-helpers";

test("retiring the final project cancels an owned OpenCode launch before readiness", async () => {
  const entered = Promise.withResolvers<AbortSignal>();
  const release = Promise.withResolvers<void>();
  const harness = createOpencodeHarness(
    {},
    {
      startServer: async ({ signal }) => {
        entered.resolve(signal);
        await release.promise;
        return { url: "http://127.0.0.1:4096", dispose: async () => {} };
      },
      pingServer: async () => false,
      isPortOpen: async () => false,
      fetcher: async (url, init) => {
        if (new URL(String(url)).pathname === "/session") return Response.json({ id: "late" });
        if (init?.method === "POST") return Response.json(true);
        return Response.json([]);
      },
    },
  );
  const starting = Promise.resolve(
    harness.start(ctx, {
      sessionId: "host-session",
      prompt: "work",
      cwd: "/tmp",
      events: { push() {}, getMessages: () => [] },
    }),
  ).catch((error: unknown) => error);
  const signal = await entered.promise;
  const cleanup = harness.dispose!(ctx);
  try {
    await Bun.sleep(0);
    expect(signal.aborted).toBe(true);
  } finally {
    release.resolve();
    await Promise.allSettled([starting, cleanup]);
  }
});
