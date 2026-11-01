import { expect, spyOn, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createExtensionDocumentSync } from "./documents";

test("a new document saved offline invalidates exact progress without loading its directory", async () => {
  const app = await createTestApp();
  // Empty wire-level documents need neither updates nor blobs to complete their first download.
  const peer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname.endsWith("/keys"))
        return Response.json({
          project: [{ generation: 1, secret: "A".repeat(43) }],
          personal: [{ generation: 1, secret: "B".repeat(43) }],
        });
      return Response.json({ status: "updates", state: null, lastSequence: 0, updates: [], more: false });
    },
  });
  const project = await app.deps.projectService.create({ name: "Sync progress" });
  const owner = { workbenchId: project.id, extensionId: "example.notes" };
  const sync = createExtensionDocumentSync({
    owner,
    deps: app.deps,
    config: {
      accountId: "owner",
      workbenchId: project.id,
      environmentId: "device",
      managerOrigin: peer.url.origin,
      relayOrigin: peer.url.origin,
      renewalGrant: "credential",
    },
    access: async () => ({ token: "access", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
  });
  const listing = spyOn(app.deps.extensionStorageService.documents, "list");
  try {
    await sync.synchronize(new AbortController().signal);
    expect(await sync.status()).toMatchObject({ pendingItems: 0, download: { completed: 2, total: 2 } });
    await app.deps.extensionStorageService.documents
      .open(JSON.stringify(["text-file", "new.md"]))
      .transaction(owner, async ({ document }) => {
        document.getText("content").insert(0, "Saved offline");
      });
    listing.mockClear();
    const status = await sync.status();
    expect(status.pendingItems).toBeUndefined();
    expect(status.download.total).toBeNull();
    expect(status.downloaded).toBe(false);
    expect(listing).not.toHaveBeenCalled();
  } finally {
    listing.mockRestore();
    sync.close();
    await peer.stop(true);
    await app.close();
  }
});
