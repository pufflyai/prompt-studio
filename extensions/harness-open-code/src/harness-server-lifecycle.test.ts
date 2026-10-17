import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
import { ctx } from "./harness.test-helpers";

test("project disposal waits for a native abort already started by cancellation", async () => {
  const abortEntered = Promise.withResolvers<void>();
  const releaseAbort = Promise.withResolvers<void>();
  const releasePrompt = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  let aborts = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/session") return Response.json({ id: "native" });
      if (path === "/session/native/abort") {
        aborts++;
        abortEntered.resolve();
        await releaseAbort.promise;
        return Response.json(true);
      }
      if (request.method === "POST") {
        await releasePrompt.promise;
        return Response.json({ info: {}, parts: [] });
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
  let stopping: Promise<void> | undefined;
  let cleanup: Promise<void> | undefined;
  try {
    const session = await harness.start(ctx, {
      sessionId: "host",
      prompt: "Do work",
      cwd: "/tmp",
      events: {
        getMessages: () => [],
        push(event) {
          if (event.path === "/status" && event.value === "cancelled") cancelled.resolve();
        },
      },
    });
    stopping = Promise.resolve(session.stop());
    await Promise.all([abortEntered.promise, cancelled.promise]);
    await Bun.sleep(0);
    let stoppedAgain = false;
    const stopAgain = Promise.resolve(session.stop()).then(() => {
      stoppedAgain = true;
    });
    let disposed = false;
    cleanup = Promise.resolve(harness.dispose!(ctx)).then(() => {
      disposed = true;
    });
    await Bun.sleep(0);
    expect({ stoppedAgain, disposed }).toEqual({ stoppedAgain: false, disposed: false });
    releaseAbort.resolve();
    await Promise.all([stopping, stopAgain, cleanup, session.done]);
    expect(aborts).toBe(1);
  } finally {
    releaseAbort.resolve();
    releasePrompt.resolve();
    await stopping;
    await cleanup;
    await harness.dispose!(ctx);
    server.stop(true);
  }
});

test("concurrent discovery shares startup across project contexts", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const ports: number[] = [];
  const listening = new Set<number>();
  const healthy = new Set<string>();
  const harness = createOpencodeHarness(
    {},
    {
      startServer: async ({ host, port }) => {
        ports.push(port);
        listening.add(port);
        entered.resolve();
        await release.promise;
        const url = `http://${host}:${port}`;
        healthy.add(url);
        return { url, dispose: async () => {} };
      },
      pingServer: async (url) => healthy.has(url),
      isPortOpen: async ({ port }) => listening.has(port),
      fetcher: async () => Response.json([]),
    },
  );
  const first: HarnessContext = { ...ctx, projectId: "first" };
  const second: HarnessContext = { ...ctx, projectId: "second" };
  const discoveries = [harness.getCommandState!(first, { cwd: "/first" })];
  try {
    await entered.promise;
    discoveries.push(harness.getCommandState!(second, { cwd: "/second" }));
    await Bun.sleep(0);
  } finally {
    release.resolve();
    await Promise.all(discoveries);
  }
  expect(ports).toEqual([4096]);
});

test("disabling the last project stops its worker and preserves other projects until then", async () => {
  let stopped = 0;
  const harness = createOpencodeHarness(
    {},
    {
      startServer: async () => ({
        url: "http://127.0.0.1:4096",
        dispose: async () => {
          stopped += 1;
        },
      }),
      pingServer: async () => false,
      isPortOpen: async () => false,
      fetcher: async () => Response.json([]),
    },
  );
  const first: HarnessContext = { ...ctx, projectId: "first" };
  const second: HarnessContext = { ...ctx, projectId: "second" };
  await harness.getCommandState!(first, { cwd: "/first" });
  await harness.getCommandState!(second, { cwd: "/second" });
  await harness.dispose!(first);
  expect(stopped).toBe(0);
  await harness.dispose!(second);
  expect(stopped).toBe(1);
});

test("disabling a project leaves an externally started OpenCode server running", async () => {
  let starts = 0;
  const harness = createOpencodeHarness(
    {},
    {
      startServer: async () => {
        starts += 1;
        throw new Error("Use the existing server");
      },
      pingServer: async () => true,
      isPortOpen: async () => true,
      fetcher: async () => Response.json([]),
    },
  );
  await harness.getCommandState!(ctx, { cwd: "/project" });
  await harness.dispose!(ctx);
  expect(starts).toBe(0);
});

test("disabling a project while discovery starts releases the worker before cleanup completes", async () => {
  let started = 0;
  let stopped = 0;
  const harness = createOpencodeHarness(
    {},
    {
      startServer: async () => {
        started += 1;
        return {
          url: "http://127.0.0.1:4096",
          dispose: async () => {
            stopped += 1;
          },
        };
      },
      pingServer: async () => false,
      isPortOpen: async () => false,
      fetcher: async () => Response.json([]),
    },
  );
  const discovery = harness.getCommandState!(ctx, { cwd: "/project" });
  const result = Promise.resolve(discovery).catch(() => undefined);
  await harness.dispose!(ctx);
  await result;
  expect(stopped).toBe(started);
});
