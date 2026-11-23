import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
import { ctx } from "./harness.test-helpers";
import { readyPluginInventory } from "./native-api.test-helpers";

test.each([
  ["models", 0],
  ["models", 1],
  ["commands", 0],
  ["commands", 1],
] as const)("a retired project does not cancel another project's %s discovery (project %d)", async (kind, retiring) => {
  const requested = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      reads++;
      const path = new URL(request.url).pathname;
      if (path === "/api/plugin") {
        requested.resolve();
        await ready.promise;
        return readyPluginInventory();
      }
      if (path === "/api/model")
        return Response.json({ data: [{ id: "local", providerID: "fixture", enabled: true }] });
      if (path === "/api/command") return Response.json({ data: [{ name: "review" }] });
      return new Response(null, { status: 404 });
    },
  });
  const harness = createOpencodeHarness(
    { detect: async () => ({ available: true, version: "opencode v2.4.0" }) },
    {
      serverStore: { read: async () => server.url.origin, write: async () => {}, clear: async () => {} },
      pingServer: async () => true,
    },
  );
  const contexts: HarnessContext[] = [
    { ...ctx, projectId: "first" },
    { ...ctx, projectId: "second" },
    { ...ctx, projectId: "third" },
  ];
  const discover = async (context: HarnessContext) => {
    if (kind === "models") return (await harness.listModels!(context)).map((entry) => entry.id);
    return (await harness.getCommandState!(context, { cwd: "/shared" })).commands.map((entry) => entry.name);
  };
  try {
    const first = discover(contexts[0]!).catch(() => []);
    await requested.promise;
    const second = discover(contexts[1]!).catch(() => []);
    await Bun.sleep(0);
    const retirement = harness.dispose!(contexts[retiring]!);
    ready.resolve();
    const outcomes = await Promise.all([first, second]);
    await retirement;
    const expected = kind === "models" ? ["fixture/local"] : ["/compact", "/review"];
    expect(outcomes[retiring]).toEqual([]);
    expect(outcomes[1 - retiring]).toEqual(expected);

    const readsBeforeReuse = reads;
    expect(await discover(contexts[2]!)).toEqual(expected);
    expect(reads).toBe(readsBeforeReuse);
  } finally {
    ready.resolve();
    for (const context of contexts) await harness.dispose!(context);
    await server.stop(true);
  }
});
