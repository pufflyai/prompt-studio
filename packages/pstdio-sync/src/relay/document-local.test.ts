import { expect, test } from "bun:test";
import * as Y from "yjs";
import { applyDocumentUpdate } from "../document-types";
import { createMemoryDocumentStore } from "../memory-document-store";
import { createLocalDocumentComparison } from "./document-local";

const owner = { workbenchId: "project", extensionId: "notes" };

test("receive revalidates and verifies assets when a local edit changes the captured revision", async () => {
  const store = createMemoryDocumentStore();
  const local = createLocalDocumentComparison(store, owner, new AbortController().signal);
  const remote = new Y.Doc();
  remote.getMap("values").set("incoming", true);
  const observed: number[] = [];
  const accepted = await local.receive(Y.encodeStateAsUpdate(remote), async (blobs) => {
    observed.push(blobs.length);
    if (observed.length !== 1) return;
    await store.transaction(owner, async ({ document }) => {
      expect(document.getMap("values").has("incoming")).toBe(false);
      document.getMap("records").set("local-image", "local-image-record");
      document.getMap("local-image-record").set("asset", {
        sha256: "a".repeat(64),
        byteLength: 1,
        mediaType: "image/png",
      });
    });
  });
  expect(accepted).toBe(true);
  expect(observed).toEqual([0, 1]);
  expect(await store.transaction(owner, async ({ document }) => document.getMap("values").get("incoming"))).toBe(true);
  remote.destroy();
});

test("receive cannot materialize invalid local pending content with an otherwise healthy predecessor", async () => {
  const remote = new Y.Doc();
  const updates: Uint8Array[] = [];
  remote.on("update", (update: Uint8Array) => updates.push(update));
  remote.getMap("values").set("predecessor", true);
  remote.transact(() => {
    remote.getMap("records").set("bad", "bad-record");
    remote.getMap("bad-record").set("asset", { sha256: "invalid" });
  });
  const store = createMemoryDocumentStore();
  await store.transaction(owner, async (state) => applyDocumentUpdate(state, updates[1]));
  const local = createLocalDocumentComparison(store, owner, new AbortController().signal);
  let verified = false;
  expect(
    await local.receive(updates[0], async () => {
      verified = true;
    }),
  ).toBe(false);
  expect(verified).toBe(false);
  expect(await store.transaction(owner, async ({ document }) => document.getMap("values").size)).toBe(0);
  remote.destroy();
});

test("unrelated local causal gaps close as their predecessors arrive separately", async () => {
  const store = createMemoryDocumentStore();
  const local = createLocalDocumentComparison(store, owner, new AbortController().signal);
  const predecessors: Uint8Array[] = [];
  for (const name of ["first", "second"]) {
    const source = new Y.Doc();
    const updates: Uint8Array[] = [];
    source.on("update", (update: Uint8Array) => updates.push(update));
    source.getMap(name).set("before", 1);
    source.getMap(name).set("after", 2);
    await store.transaction(owner, async (state) => applyDocumentUpdate(state, updates[1]));
    predecessors.push(updates[0]);
    source.destroy();
  }
  expect(await local.receive(predecessors[0], async () => {})).toBe(true);
  expect(await store.transaction(owner, async ({ document }) => document.getMap("first").toJSON())).toEqual({
    before: 1,
    after: 2,
  });
  expect(await local.receive(predecessors[1], async () => {})).toBe(true);
  expect(await store.transaction(owner, async ({ document }) => document.getMap("second").toJSON())).toEqual({
    before: 1,
    after: 2,
  });
});

test("closing an owner prevents acceptance queued behind its storage lock", async () => {
  const store = createMemoryDocumentStore();
  const abort = new AbortController();
  const locked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const queued = Promise.withResolvers<void>();
  let holding = false;
  let lock: Promise<unknown> | undefined;
  const local = createLocalDocumentComparison(
    {
      transaction: (target, action) => {
        const result = store.transaction(target, action);
        if (holding) queued.resolve();
        return result;
      },
    },
    owner,
    abort.signal,
  );
  const remote = new Y.Doc();
  remote.getMap("values").set("incoming", true);
  const receiving = local.receive(Y.encodeStateAsUpdate(remote), async () => {
    lock = store.transaction(owner, async () => {
      locked.resolve();
      await release.promise;
    });
    await locked.promise;
    holding = true;
  });
  const rejected = receiving.catch((error: unknown) => error);
  await queued.promise;
  abort.abort(new Error("Owner closed"));
  release.resolve();
  await lock;
  expect(await rejected).toMatchObject({ message: "Owner closed" });
  expect(await store.transaction(owner, async ({ document }) => document.getMap("values").size)).toBe(0);
  remote.destroy();
});
