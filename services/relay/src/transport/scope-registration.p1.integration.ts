import { afterAll, beforeAll, expect, test } from "bun:test";
import { createRelayAdapter } from "pstdio-sync/relay";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());
test("an enrolled environment registers an extension owner without replacing an existing published revision", async () => {
  const context = await fixture.context();
  const relay = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const abort = new AbortController();
  const scope = { ...context.scope, extensionId: "ordinary.extension" };
  const adapter = createRelayAdapter({
    origin: relay.url.origin,
    scope,
    token: async () => context.token,
    signal: abort.signal,
  });
  try {
    await adapter.initialize("published-first");
    expect((await adapter.snapshot()).publishedRevision).toBe("published-first");
    await adapter.initialize("local-override");
    expect((await adapter.snapshot()).publishedRevision).toBe("published-first");
    const foreign = createRelayAdapter({
      origin: relay.url.origin,
      scope: { ...scope, workbenchId: "foreign-workbench" },
      token: async () => context.token,
      signal: abort.signal,
    });
    await expect(foreign.initialize("forbidden")).rejects.toThrow("401");
    await expect(context.storage.owner({ ...scope, workbenchId: "foreign-workbench" }).snapshot()).rejects.toThrow();
  } finally {
    abort.abort();
    await relay.stop(true);
    await context.close();
  }
});
