import { expect, test } from "bun:test";
import { createRelayAccess, fetchSyncSpaces } from "pstdio-sync/relay";
import { managedExtensionHostHeader, managedExtensionHostVersion } from "pstdio-sync-contracts";
import { managerRequest } from "../account/manager-client";
import { createNativeRelayAccess, fetchNativeSyncSpaces } from "./native-relay-access";

test("the enforcing host advertises managed policy support while generic sync clients opt in explicitly", async () => {
  const calls: { path: string; capability: string | null }[] = [];
  const secret = Buffer.alloc(32, 7).toString("base64url");
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      calls.push({ path, capability: request.headers.get(managedExtensionHostHeader) });
      if (path.endsWith("/keys"))
        return Response.json({ project: [{ generation: 1, secret }], personal: [{ generation: 1, secret }] });
      return Response.json({ token: "fixture-access", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    },
  });
  try {
    const signal = new AbortController().signal;
    const access = {
      managerOrigin: manager.url.origin,
      renewalGrant: "fixture-device",
      workbenchId: "project",
      signal,
    };
    await createRelayAccess(access)();
    await createRelayAccess({ ...access, managedExtensions: managedExtensionHostVersion })();
    await createNativeRelayAccess(access)();
    const keys = {
      managerOrigin: manager.url.origin,
      accountId: "user",
      workbenchId: "project",
      credential: "fixture-device",
      signal,
    };
    await fetchSyncSpaces(keys);
    await fetchNativeSyncSpaces(keys);
    await managerRequest(manager.url.origin, "/v1/account", "fixture-device");
    expect(calls.filter(({ path }) => path === "/v1/environment-access").map(({ capability }) => capability)).toEqual([
      null,
      managedExtensionHostVersion,
      managedExtensionHostVersion,
    ]);
    expect(calls.filter(({ path }) => path.endsWith("/keys")).map(({ capability }) => capability)).toEqual([
      null,
      managedExtensionHostVersion,
    ]);
    expect(calls.find(({ path }) => path === "/v1/account")?.capability).toBe(managedExtensionHostVersion);
  } finally {
    await manager.stop(true);
  }
});
