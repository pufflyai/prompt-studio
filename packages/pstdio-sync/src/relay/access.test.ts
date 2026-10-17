import { expect, test } from "bun:test";
import { createRelayAccess } from "./access";

test("a manager outage leaves cached access usable through its original expiry", async () => {
  const expiresAt = new Date(Date.now() + 2000).toISOString();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => Response.json({ token: "owned-finite-access", expiresAt }),
  });
  const controller = new AbortController();
  const access = createRelayAccess({
    managerOrigin: server.url.origin,
    workbenchId: "owned-workbench",
    renewalGrant: "owned-grant",
    signal: controller.signal,
  });
  try {
    const issued = await access();
    await server.stop(true);
    await Bun.sleep(1700);
    expect(await access()).toEqual(issued);
    await Bun.sleep(350);
    await expect(access()).rejects.toThrow();
  } finally {
    controller.abort();
    await server.stop(true);
  }
});
