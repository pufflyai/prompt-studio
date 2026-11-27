import { expect, test } from "bun:test";
import { createWorkbenchAccess } from "./workbench-updates";

test("an expired team lease cannot authorize writes before the shared live connection renews", async () => {
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      expect(new URL(request.url).pathname).toBe("/v1/environment-access");
      const token = `fixture-${++requests}`;
      return Response.json({ token, expiresAt: new Date(Date.now() + 400).toISOString() });
    },
  });
  const runtime = new AbortController();
  const access = createWorkbenchAccess(
    {
      accountId: "team",
      userId: "person",
      workbenchId: "project",
      environmentId: "device",
      relayOrigin: server.url.origin,
      managerOrigin: server.url.origin,
      renewalGrant: "fixture",
    },
    runtime.signal,
  );
  try {
    const first = await access.connect();
    expect(await access()).toEqual(first);
    await Bun.sleep(Math.max(0, Date.parse(first.expiresAt) - Date.now()) + 5);

    await expect(access()).rejects.toThrow("Team Cloud connection is renewing");
    expect(requests).toBe(1);

    expect((await access.connect()).token).toBe("fixture-2");
    expect((await access()).token).toBe("fixture-2");
  } finally {
    runtime.abort();
    access.close();
    await server.stop(true);
  }
});
