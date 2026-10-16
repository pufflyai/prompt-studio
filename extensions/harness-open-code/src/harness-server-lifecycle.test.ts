import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
import { ctx } from "./harness.test-helpers";

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
