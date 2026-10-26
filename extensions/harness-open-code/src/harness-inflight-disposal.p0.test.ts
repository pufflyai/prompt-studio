import { expect, test } from "bun:test";
import { createOpencodeHarness } from "./harness";
import { ctx } from "./harness.test-helpers";

test("retiring a project during native creation prevents prompts and aborts the created session", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let prompts = 0;
  let aborts = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/session") {
        entered.resolve();
        await release.promise;
        return Response.json({ id: "late" });
      }
      if (path === "/session/late/abort") {
        aborts += 1;
        return Response.json(true);
      }
      if (request.method === "POST") {
        prompts += 1;
        return Response.json({});
      }
      return Response.json([]);
    },
  });
  const harness = createOpencodeHarness(
    {},
    {
      serverStore: { read: async () => server.url.origin, write: async () => {}, clear: async () => {} },
      pingServer: async () => true,
    },
  );
  const starting = Promise.resolve(
    harness.start(ctx, {
      sessionId: "host-session",
      prompt: "Do work",
      cwd: "/tmp",
      events: { push() {}, getMessages: () => [] },
    }),
  ).catch((error: unknown) => error);
  try {
    await entered.promise;
    const cleanup = harness.dispose!(ctx);
    await Bun.sleep(0);
    release.resolve();
    await cleanup;
    expect(await starting).toBeInstanceOf(Error);
    await Bun.sleep(0);
    expect({ prompts, aborts }).toEqual({ prompts: 0, aborts: 1 });
  } finally {
    release.resolve();
    await starting;
    await harness.dispose!(ctx);
    server.stop(true);
  }
});
