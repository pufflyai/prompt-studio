import { expect, test } from "bun:test";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { getExtensionConnectionOperations } from "./use-extension-connections";

test("disconnects the project or revokes the selected saved sign-in at its canonical origin", async () => {
  const calls: Array<{ method: string; query: Record<string, string> }> = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/projects/project/extension-connections/fixture/remote")
        calls.push({ method: request.method, query: Object.fromEntries(url.searchParams) });
      return new Response(null, { status: 204 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  try {
    const service = getExtensionConnectionOperations(owner);
    const authority = service.authority();
    const target = { extensionId: "fixture", localId: "remote" };
    const revoke = { action: "revoke", baseUrl: "https://FIXTURE.invalid:443/api" } as const;
    await service.change("project", target, { action: "disconnect" }, authority);
    await service.change("project", target, revoke, authority);
    await service.change("project", { ...target, scope: "global" }, revoke, authority);
    expect(calls).toEqual([
      { method: "DELETE", query: { credentialScope: "project" } },
      {
        method: "DELETE",
        query: { credentialScope: "all-projects", origin: "https://fixture.invalid", signInScope: "shared" },
      },
      {
        method: "DELETE",
        query: { credentialScope: "all-projects", origin: "https://fixture.invalid", signInScope: "global" },
      },
    ]);
  } finally {
    await owner.dispose();
    await server.stop(true);
  }
});

test("a global connection has one pending request and recovery retains no credential", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let writes = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.method !== "PUT") return Response.json({ error: "Unexpected route" }, { status: 404 });
      await request.json();
      writes++;
      entered.resolve();
      await release.promise;
      return Response.json({ error: "Response lost" }, { status: 503 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const service = getExtensionConnectionOperations(owner);
  const authority = service.authority();
  const target = { extensionId: "fixture", localId: "remote", scope: "global" } as const;
  const configure = {
    action: "configure",
    baseUrl: "https://user:fixture-password@fixture.invalid/token-in-path",
    secret: "fixture-secret",
  } as const;
  try {
    const request = service.change("project-a", target, configure, authority);
    await entered.promise;
    expect(service.active("project-b", target)?.status).toBe("writing");
    await expect(
      service.change("project-b", target, { action: "revoke", baseUrl: configure.baseUrl }, authority),
    ).rejects.toThrow("pending change");
    release.resolve();
    await expect(request).rejects.toThrow("Response lost");
    const recovery = operations.getSnapshot().recovery[0]!;
    expect(recovery.draft).toEqual({
      extensionId: "fixture",
      connectionId: "remote",
      origin: "https://fixture.invalid",
    });
    operations.discard(recovery.id);
    await expect(service.change("project-b", target, configure, authority)).rejects.toThrow("pending change");
    expect(writes).toBe(1);
  } finally {
    release.resolve();
    await owner.dispose();
    await server.stop(true);
  }
});

test("checks a lost revoke reply against the exact saved sign-in while a private connection remains", async () => {
  const origin = "https://fixture.invalid";
  const identity = { extensionId: "fixture", connectionId: "remote" };
  const selected = { ...identity, origin, signInScope: "shared" };
  const siblingSignIns = [
    { ...identity, origin, signInScope: "global" },
    { ...selected, origin: "https://other.invalid" },
  ];
  let savedSignIns: (typeof selected)[] | undefined;
  let writes = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (request.method === "DELETE") {
        writes++;
        return Response.json({ error: "Response lost" }, { status: 503 });
      }
      return Response.json({
        connections: [{ ...identity, baseUrl: `${origin}/api`, configured: true }],
        savedSignIns,
      });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const service = getExtensionConnectionOperations(owner);
  try {
    const target = { extensionId: identity.extensionId, localId: identity.connectionId };
    await expect(
      service.change("project", target, { action: "revoke", baseUrl: origin }, service.authority()),
    ).rejects.toThrow("Response lost");
    const recovery = operations.getSnapshot().recovery[0]!;
    await operations.check(recovery.id);
    expect(operations.getSnapshot().recovery).toHaveLength(1);
    savedSignIns = [...siblingSignIns, selected];
    await operations.check(recovery.id);
    expect(operations.getSnapshot().recovery).toHaveLength(1);
    savedSignIns = siblingSignIns;
    await operations.check(recovery.id);
    expect(operations.getSnapshot().recovery).toEqual([]);
    expect(writes).toBe(1);
  } finally {
    await owner.dispose();
    await server.stop(true);
  }
});
