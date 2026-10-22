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

test("a rejected device credential reports denial; an unavailable manager does not", async () => {
  let status = 401;
  const manager = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response(null, { status }) });
  let denials = 0;
  const access = createRelayAccess({
    managerOrigin: manager.url.origin,
    renewalGrant: "removed-device",
    workbenchId: "workbench",
    signal: new AbortController().signal,
    denied: () => {
      denials += 1;
    },
  });
  try {
    await expect(access()).rejects.toThrow("Environment renewal unavailable");
    expect(denials).toBe(1);
    status = 503;
    await expect(access()).rejects.toThrow("Environment renewal unavailable");
    expect(denials).toBe(1);
  } finally {
    await manager.stop(true);
  }
});
