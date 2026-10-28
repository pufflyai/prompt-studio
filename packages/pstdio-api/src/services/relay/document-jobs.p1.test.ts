import { expect, test } from "bun:test";
import { createMemoryDocumentStore } from "pstdio-sync";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createDocumentSync } from "pstdio-sync/relay";
import { createRelayDocumentJobs } from "./document-jobs";
import { numberRelayFixture } from "./resource-number-sync.fixture";

test("discovery and repeated exact hints share one replica and retain edits admitted during its run", async () => {
  const controller = new AbortController();
  const owner = { workbenchId: "project", extensionId: "example.notes" };
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: null,
    keys: [{ generation: 1, secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url") }],
  });
  const store = createMemoryDocumentStore();
  const peer = createMemoryDocumentStore();
  const fixture = numberRelayFixture();
  const relay = fixture.relay("document");
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let creations = 0;
  let active = 0;
  let maximum = 0;
  let hold = true;
  const jobs = createRelayDocumentJobs({
    signal: controller.signal,
    create: async () => {
      creations++;
      return {
        documentId: "document",
        sync: createDocumentSync({
          owner,
          space,
          documentId: "document",
          store,
          quarantine: async () => {},
          relay: {
            ...relay,
            read: async (after) => {
              maximum = Math.max(maximum, ++active);
              try {
                if (hold) {
                  hold = false;
                  entered.resolve();
                  await release.promise;
                }
                return await relay.read(after);
              } finally {
                active--;
              }
            },
          },
        }),
      };
    },
  });
  const remote = createDocumentSync({
    owner,
    space,
    documentId: "document",
    store: peer,
    relay,
    quarantine: async () => {},
  });
  const first = jobs.synchronize("text");
  try {
    await entered.promise;
    await store.transaction(owner, async ({ document }) => {
      document.getText("content").insert(0, "late edit");
    });
    const repeats = Array.from({ length: 100 }, () => jobs.synchronize("text"));
    expect(new Set([first, ...repeats]).size).toBe(1);
    expect(jobs.status().pending).toBe(true);
    release.resolve();
    await Promise.all([first, ...repeats]);
    await remote.synchronize();
    expect(await peer.transaction(owner, async ({ document }) => document.getText("content").toString())).toBe(
      "late edit",
    );
    expect(creations).toBe(1);
    expect(maximum).toBe(1);
    expect(jobs.status()).toEqual({ downloaded: true, pending: false, needsAttention: false });
  } finally {
    release.resolve();
    controller.abort();
    await first.catch(() => {});
    await jobs.close();
    remote.close();
  }
});
