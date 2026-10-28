import { expect, test } from "bun:test";
import { createMemoryDocumentStore } from "pstdio-sync";
import { createSyncSpace } from "pstdio-sync/encryption";
import { coreOwnerId, rememberResourceNumber, resourceNumbers, resourceNumbersDocumentId } from "pstdio-sync/records";
import { createDocumentSync } from "pstdio-sync/relay";
import { createTestApp } from "../../test-utils/create-test-app";
import { createResourceNumberSync } from "./resource-number-sync";
import { numberRelayFixture } from "./resource-number-sync.fixture";

test("an empty project rechecks an empty old source without publishing that format", async () => {
  const app = await createTestApp();
  const relay = numberRelayFixture();
  try {
    const project = await app.deps.projectService.create({ name: "Empty numbers" });
    const owner = { workbenchId: project.id, extensionId: coreOwnerId };
    const space = await createSyncSpace({
      projectId: project.id,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const legacyId = await space.documentId(JSON.stringify([coreOwnerId, resourceNumbersDocumentId]));
    for (let reconnect = 0; reconnect < 2; reconnect++) {
      const sync = await createResourceNumberSync({
        owner,
        space,
        service: app.deps.extensionResourceSequencesService,
        relay: relay.relay,
        quarantine: () => async () => {
          throw new Error("Bad core data");
        },
      });
      await sync.synchronize();
      expect((await sync.status()).downloaded).toBe(true);
    }
    expect(relay.requests(legacyId)).toEqual({ reads: 2, writes: 0 });
    expect(await app.deps.extensionResourceSequencesService.recordStream(project.id).hasRecords()).toBe(false);
  } finally {
    await app.close();
  }
});

test("a reset device recovers remote-only old numbers once then follows the core record stream", async () => {
  const app = await createTestApp();
  const reset = await createTestApp();
  const relay = numberRelayFixture();
  const project = await app.deps.projectService.create({ name: "Number recovery" });
  await reset.deps.projectService.create({ id: project.id, name: "Number recovery" });
  const owner = { workbenchId: project.id, extensionId: coreOwnerId };
  const space = await createSyncSpace({
    projectId: project.id,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const legacyId = await space.documentId(JSON.stringify([coreOwnerId, resourceNumbersDocumentId]));
  const memory = createMemoryDocumentStore();
  const old = createDocumentSync({
    owner,
    space,
    documentId: legacyId,
    relay: relay.relay(legacyId),
    store: memory,
    quarantine: async () => {
      throw new Error("Bad legacy data");
    },
  });
  try {
    await memory.transaction(owner, async ({ document }) => {
      const resource = { id: "old-resource", extensionId: "example.items", kind: "item", prefix: "IT", value: 7 };
      rememberResourceNumber(document, { ...resource, value: 1 });
      resourceNumbers(document).set(resource.id, resource);
      rememberResourceNumber(document, resource);
    });
    await old.synchronize();
    old.close();
    const writes = relay.requests(legacyId).writes;
    const start = (target: typeof app) =>
      createResourceNumberSync({
        owner,
        space,
        service: target.deps.extensionResourceSequencesService,
        relay: relay.relay,
        quarantine: () => async () => {
          throw new Error("Bad core data");
        },
      });
    const first = await start(app);
    await first.synchronize();
    const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    expect(await app.deps.extensionResourceSequencesService.identity({ ...input, id: "old-resource" })).toEqual({
      id: "old-resource",
      kind: "item",
      shorthand: "IT-7",
      aliases: ["IT-1"],
    });
    expect(relay.requests(legacyId).writes).toBe(writes);
    const reads = relay.requests(legacyId).reads;
    const next = await app.deps.extensionResourceSequencesService.allocate(input);
    expect(next.shorthand).toBe("IT-8");
    await first.synchronize();
    const second = await start(reset);
    await second.synchronize();
    expect((await reset.deps.extensionResourceSequencesService.identity({ ...input, id: next.id }))?.shorthand).toBe(
      "IT-8",
    );
    expect(
      (await reset.deps.extensionResourceSequencesService.findByShorthand({ ...input, shorthand: "IT-1" })).map(
        (r) => r.id,
      ),
    ).toEqual(["old-resource"]);
    const reconnected = await start(app);
    await reconnected.synchronize();
    expect(relay.requests(legacyId).reads).toBe(reads);
  } finally {
    old.close();
    await reset.close();
    await app.close();
  }
});
