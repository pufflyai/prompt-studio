import { expect, test } from "bun:test";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { getExtensionConnectionOperations } from "./use-extension-connections";

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
    await expect(service.change("project-b", target, { action: "revoke" }, authority)).rejects.toThrow(
      "pending change",
    );
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
