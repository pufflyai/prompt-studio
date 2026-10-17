import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, createExtensionConnectionsDBService, createProjectsDBService } from "pstdio-db";
import { createFileConnectionSecretStore } from "./connection-secret-store";
import { createExtensionConnectionService, createExtensionConnectionsApi } from "./extension-connection-service";
import { contribution } from "./extension-connection-service.test-fixture";

test("connection credentials stay with their runtime and workbench when extension IDs overlap", async () => {
  const root = await mkdtemp(join(tmpdir(), "connection-owners-"));
  const received: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      received.push(request.headers.get("authorization")!);
      return Response.json({ ok: true });
    },
  });
  try {
    for (const runtime of ["first", "second"]) {
      const store = await createDb({ path: ":memory:" });
      try {
        const connections = createExtensionConnectionService({
          connectionsDBService: createExtensionConnectionsDBService(store.db),
          secretStore: createFileConnectionSecretStore(join(root, runtime)),
          getContribution: async () => contribution,
        });
        for (const projectId of ["shared", "other"]) {
          await createProjectsDBService(store.db).create({ id: projectId, name: projectId });
          await connections.configure({
            projectId,
            extensionId: "same.extension",
            connectionId: contribution.id,
            baseUrl: server.url.origin,
            secret: `${runtime}-${projectId}-credential`,
          });
        }
        for (const projectId of ["shared", "other", "shared"]) {
          const api = createExtensionConnectionsApi(connections, { projectId, extensionId: "same.extension" });
          expect((await api.request(contribution.id, { method: "GET", path: "/v1/workspaces" })).status).toBe(200);
          expect(received.at(-1)).toBe(`Bearer ${runtime}-${projectId}-credential`);
        }
      } finally {
        await store.close();
      }
    }
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
