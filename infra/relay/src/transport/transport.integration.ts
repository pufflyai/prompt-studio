import { afterAll, beforeAll, expect, test } from "bun:test";
import { relayPath, snapshotSchema } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("a current environment reads its initialized relay scope through real HTTP authority", async () => {
  const context = await fixture.context();
  const server = startRelay(
    { hostname: "127.0.0.1", port: 0 },
    {
      storage: context.storage,
      assets: context.assets,
      verifyAccess: context.verifyAccess,
      recovery: context.recovery,
    },
  );
  try {
    const { workbenchId, extensionId } = context.scope;
    const path = relayPath({ workbenchId, extensionId }, "snapshot");
    const response = await fetch(new URL(path, server.url), { headers: { authorization: `Bearer ${context.token}` } });
    expect(response.status).toBe(200);
    const snapshot = snapshotSchema.parse(await response.json());
    expect(snapshot.scope).toEqual(context.scope);
    expect(snapshot.records).toEqual({});
    const health = await fetch(new URL("/health", server.url));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect((await fetch(new URL("/sync", server.url))).status).toBe(404);
  } finally {
    await server.stop(true);
    await context.close();
  }
});
