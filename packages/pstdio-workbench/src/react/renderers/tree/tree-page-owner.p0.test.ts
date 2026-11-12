import { expect, test } from "bun:test";
import type { TreeNodePage, TreePageLoader } from "../../../core";
import { createRendererQueryCache } from "../../../core/registries/views/renderer-query-cache";
import { getTreePageOwner, type PagedTreeData } from "./tree-page-owner";

const tree = (load: TreePageLoader, id = "first"): PagedTreeData => ({
  header: [],
  footer: [],
  children: {},
  body: [{ id: "history", nodes: [{ id, label: id }], nextPage: load }],
});
const fixture = async (initial: PagedTreeData) => {
  const cache = createRendererQueryCache();
  const identity = {
    sourceId: "history",
    queryKey: "project/history/filter/metadata",
    queryScope: { projectId: "p", extensionId: "history" },
  };
  let value = initial;
  const read = () =>
    cache.read({ ...identity, load: () => value, onValue() {}, onError() {} }, new AbortController().signal, () => {});
  await read();
  const owner = getTreePageOwner(cache, identity)!;
  const stop = owner.attach(() => {});
  owner.accept(initial, initial);
  return {
    cache,
    identity,
    owner,
    stop,
    async replace(next: PagedTreeData) {
      value = next;
      cache.invalidate(identity.sourceId);
      const accepted = await read();
      owner.accept(accepted, accepted);
    },
  };
};

test("duplicate views share a cursor and clean returns retain loaded pages without revalidation reads", async () => {
  const child = Promise.withResolvers<TreeNodePage>();
  let calls = 0;
  let signal!: AbortSignal;
  const value = tree(async (input) => {
    calls++;
    signal = input;
    return child.promise;
  });
  const f = await fixture(value);
  const peer = getTreePageOwner(f.cache, f.identity)!;
  const stopPeer = peer.attach(() => {});
  expect(peer).toBe(f.owner);
  const pending = Promise.resolve(f.owner.sections()!.body[0]!.pagination!.loadMore());
  await Promise.resolve(peer.sections()!.body[0]!.pagination!.loadMore());
  await Bun.sleep(0);
  expect(calls).toBe(1);
  f.stop();
  expect(signal.aborted).toBe(false);
  child.resolve({ nodes: [{ id: "second", label: "second" }] });
  await pending;
  expect(peer.sections()!.body[0]!.nodes.map((node) => node.id)).toEqual(["first", "second"]);
  stopPeer();
  const returning = getTreePageOwner(f.cache, f.identity)!;
  const stopReturn = returning.attach(() => {});
  returning.accept(value, value);
  await returning.revalidate(new Set(["section:history"]));
  expect(returning.sections()!.body[0]!.nodes.map((node) => node.id)).toEqual(["first", "second"]);
  expect(calls).toBe(1);
  stopReturn();
  f.cache.dispose();
});

test("a presentation arriving after its root retires cannot observe the retired owner", async () => {
  const f = await fixture(tree(async () => ({ nodes: [] })));
  f.cache.get(f.identity)!.query.dispose();
  expect(() => f.owner.attach(() => {})).not.toThrow();
  expect(f.owner.sections()).toBeUndefined();
  f.stop();
  f.cache.dispose();
});

test("invalidation fences old cursors immediately and replacement pages drain their actual child", async () => {
  const child = Promise.withResolvers<TreeNodePage>();
  let oldCalls = 0;
  let freshCalls = 0;
  let signal!: AbortSignal;
  const f = await fixture(
    tree(async (input) => {
      oldCalls++;
      signal = input;
      return child.promise;
    }),
  );
  const old = f.owner.sections()!.body[0]!.pagination!;
  const pending = Promise.resolve(old.loadMore());
  await Bun.sleep(0);
  f.cache.invalidate(f.identity.sourceId);
  expect(signal.aborted).toBe(true);
  await Promise.resolve(old.loadMore());
  expect(oldCalls).toBe(1);
  await f.replace(
    tree(async () => {
      freshCalls++;
      return { nodes: [{ id: "fresh-child", label: "fresh" }] };
    }, "fresh"),
  );
  const fresh = Promise.resolve(f.owner.sections()!.body[0]!.pagination!.loadMore());
  await Bun.sleep(0);
  expect(freshCalls).toBe(0);
  child.resolve({ nodes: [{ id: "late", label: "late" }] });
  await Promise.all([pending, fresh]);
  expect(freshCalls).toBe(1);
  expect(f.owner.sections()!.body[0]!.nodes.map((node) => node.id)).toEqual(["fresh", "fresh-child"]);
  f.stop();
  f.cache.dispose();
});

test("a shared write suspends cursor admission until an accepted fresh root and restores visible loaded depth", async () => {
  let calls = 0;
  const first = tree(async () => {
    calls++;
    return { nodes: [{ id: "second", label: "second" }] };
  });
  const f = await fixture(first);
  await Promise.resolve(f.owner.sections()!.body[0]!.pagination!.loadMore());
  const resume = f.cache.holdForMutation(f.identity);
  const dirty = tree(async () => {
    calls++;
    return { nodes: [{ id: "new-second", label: "new second" }] };
  }, "new-first");
  await f.owner.revalidate(new Set(["section:history"]));
  expect(calls).toBe(1);
  expect(f.owner.sections()!.body[0]!.nodes.map((node) => node.id)).toEqual(["first", "second"]);
  resume();
  await f.replace(dirty);
  const before = f.owner.sections()!.body[0]!;
  expect(before.nodes.map((node) => node.id)).toEqual(["first", "second"]);
  await f.owner.revalidate(new Set());
  expect(calls).toBe(1);
  await f.owner.revalidate(new Set(["section:history"]));
  expect(calls).toBe(2);
  expect(f.owner.sections()!.body[0]!.nodes.map((node) => node.id)).toEqual(["new-first", "new-second"]);
  f.stop();
  f.cache.dispose();
});

test("retiring only the root query cannot alias its surviving continuation values", async () => {
  const f = await fixture(tree(async () => ({ nodes: [{ id: "old-child", label: "old" }] })));
  await Promise.resolve(f.owner.sections()!.body[0]!.pagination!.loadMore());
  f.cache.get(f.identity)!.query.dispose();
  f.stop();
  let calls = 0;
  const value = tree(async () => {
    calls++;
    return { nodes: [{ id: "new-child", label: "new" }] };
  }, "new-first");
  const accepted = await f.cache.read(
    { ...f.identity, load: () => value, onValue() {}, onError() {} },
    new AbortController().signal,
    () => {},
  );
  const replacement = getTreePageOwner(f.cache, f.identity)!;
  const stop = replacement.attach(() => {});
  replacement.accept(accepted, accepted);
  await Promise.resolve(replacement.sections()!.body[0]!.pagination!.loadMore());
  expect(calls).toBe(1);
  expect(replacement.sections()!.body[0]!.nodes.map((node) => node.id)).toEqual(["new-first", "new-child"]);
  stop();
  f.cache.dispose();
});

test("peer presentations cannot erase a known lazy result with an absent child entry", async () => {
  const first = tree(async () => ({ nodes: [{ id: "folder", label: "folder", collapsible: true }] }));
  const f = await fixture(first);
  await Promise.resolve(f.owner.sections()!.body[0]!.pagination!.loadMore());
  f.owner.accept({ ...first, children: { folder: [{ id: "lazy", label: "lazy" }] } }, first);
  const peer = getTreePageOwner(f.cache, f.identity)!;
  const stop = peer.attach(() => {});
  peer.accept(first, first);
  expect(f.owner.sections()!.body[0]!.nodes[1]!.children?.map((node) => node.id)).toEqual(["lazy"]);
  peer.accept({ ...first, children: { folder: [] } }, first);
  expect(f.owner.sections()!.body[0]!.nodes[1]!.children).toEqual([]);
  stop();
  f.stop();
  f.cache.dispose();
});

test("a failed root refresh retains rows without admitting its obsolete cursors", async () => {
  let calls = 0;
  const first = tree(async () => {
    calls++;
    return { nodes: [{ id: "child", label: "child" }] };
  });
  const f = await fixture(first);
  f.cache.invalidate(f.identity.sourceId);
  await f.cache
    .read(
      {
        ...f.identity,
        load: () => {
          throw new Error("offline");
        },
        onValue() {},
        onError() {},
      },
      new AbortController().signal,
      () => {},
    )
    .catch(() => {});
  // useRendererRead retains the old value on its onError path and ends loading.
  f.owner.accept(first, first);
  await Promise.resolve(f.owner.sections()!.body[0]!.pagination!.loadMore());
  await f.owner.revalidate(new Set(["section:history"]));
  expect(calls).toBe(0);
  expect(f.owner.sections()!.body[0]!.nodes.map((node) => node.id)).toEqual(["first"]);
  await f.replace(
    tree(async () => {
      calls++;
      return { nodes: [{ id: "fresh-child", label: "fresh" }] };
    }),
  );
  await Promise.resolve(f.owner.sections()!.body[0]!.pagination!.loadMore());
  expect(calls).toBe(1);
  f.stop();
  f.cache.dispose();
});

test("core retirement detaches its page observation, preserves peer work and drains the actual continuation", async () => {
  const { createScopedQueryClient } = await import("@pstdio/sdk/extensions");
  const { createWorkbench } = await import("../../../core");
  const { getRendererReadCache } = await import("../../../core/registries/views/renderer-read-registry");
  const queries = createScopedQueryClient({ runtimeId: "shared-page-runtime", extensionId: "history" });
  const first = createWorkbench({ queries });
  const second = createWorkbench({ queries });
  const caches = [first, second].map((core) => getRendererReadCache(core.views.reads));
  const child = Promise.withResolvers<TreeNodePage>();
  let signal!: AbortSignal;
  const value = tree(async (input) => {
    signal = input;
    return child.promise;
  });
  const identity = { sourceId: "history", queryKey: "same-query" };
  for (const cache of caches)
    await cache.read(
      { ...identity, load: () => value, onValue() {}, onError() {} },
      new AbortController().signal,
      () => {},
    );
  const owner = getTreePageOwner(caches[0]!, identity)!;
  owner.attach(() => {}, caches[0]!);
  owner.attach(() => {}, caches[1]!);
  owner.accept(value, value);
  const job = Promise.resolve(owner.sections()!.body[0]!.pagination!.loadMore());
  await Bun.sleep(0);
  let firstClosed = false;
  const closingFirst = first.dispose().then(() => {
    firstClosed = true;
  });
  await Bun.sleep(0);
  expect(signal.aborted).toBe(false);
  expect(firstClosed).toBe(false);
  const root = caches[1]!.get(identity)!.query;
  expect(root.inspect().observers).toBe(1);
  let secondClosed = false;
  const closingSecond = second.dispose().then(() => {
    secondClosed = true;
  });
  await Bun.sleep(0);
  expect(signal.aborted).toBe(true);
  expect(secondClosed).toBe(false);
  child.resolve({ nodes: [{ id: "late", label: "late" }] });
  await Promise.all([job, closingFirst, closingSecond]);
  expect(root.inspect().observers).toBe(0);
  expect(root.isDisposed()).toBe(false);
  queries.dispose();
  expect(owner.sections()).toBeUndefined();
});
