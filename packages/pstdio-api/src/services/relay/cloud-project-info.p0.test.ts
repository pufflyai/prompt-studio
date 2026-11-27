import { expect, test } from "bun:test";
import { createSyncSpace, sealUpdate } from "pstdio-sync/encryption";
import { coreOwnerId, projectInfoDocumentId, writeProjectInfo } from "pstdio-sync/records";
import * as Y from "yjs";
import { readCloudProjectInfo } from "./cloud-project-info";

test("looking up a team project never compacts its encrypted relay history", async () => {
  const workbenchId = "remote-project";
  const key = { generation: 1, secret: Buffer.alloc(32, 7).toString("base64url") };
  const space = await createSyncSpace({ projectId: workbenchId, spaceOwner: null, keys: [key] });
  const documentId = await space.documentId(JSON.stringify([coreOwnerId, projectInfoDocumentId]));
  const state = new Y.Doc();
  writeProjectInfo(state, { name: "Team project" });
  const bytes = Y.encodeStateAsUpdate(state);
  state.destroy();
  const updates = await Promise.all(
    Array.from({ length: 1001 }, async (_, index) => {
      const { updateId, payload } = await sealUpdate(space, documentId, bytes, []);
      return { updateId, payload, sequence: index + 1, deviceId: "fixture", createdAt: new Date(0).toISOString() };
    }),
  );
  let leases = 0;
  const writes: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/environment-access") {
        leases++;
        return Response.json({ token: "fixture", expiresAt: new Date(Date.now() + 30_000).toISOString() });
      }
      if (path.endsWith("/keys")) return Response.json({ project: [key], personal: [key] });
      if (path.endsWith("/read")) {
        const { after = 0 } = (await request.json()) as { after?: number };
        const page = updates.slice(after, after + 200);
        return Response.json({
          status: "updates",
          state: null,
          updates: page,
          more: after + page.length < updates.length,
          lastSequence: updates.length,
        });
      }
      writes.push(path);
      return new Response(null, { status: 405 });
    },
  });
  try {
    const discovered = await readCloudProjectInfo(
      {
        accountId: "team",
        userId: "person",
        workbenchId,
        environmentId: "device",
        relayOrigin: server.url.origin,
        managerOrigin: server.url.origin,
        renewalGrant: "fixture",
      },
      new AbortController().signal,
    );
    expect(discovered.info.name).toBe("Team project");
    expect(writes).toEqual([]);
    expect(leases).toBe(1);
  } finally {
    await server.stop(true);
  }
});
