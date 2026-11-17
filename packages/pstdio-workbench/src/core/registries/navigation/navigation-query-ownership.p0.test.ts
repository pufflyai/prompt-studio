import { expect, test } from "bun:test";
import { createScopedQueryClient, type QueryChangeEnvelope } from "@pstdio/sdk/extensions";
import { createNavigationTreeRegistry } from "./navigation-tree-registry";

const owner = { kind: "mode", id: "project", extensionId: "pstdio" } as const;
const sections = [{ id: "notes", nodes: [{ id: "one", label: "One" }] }];

test("duplicate navigation consumers share a scoped progressive read and release independently", async () => {
  const registry = createNavigationTreeRegistry();
  const gate = Promise.withResolvers<void>();
  let calls = 0;
  let aborted = false;
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    async getSections({ signal, onProgress }) {
      calls++;
      onProgress?.(sections);
      await gate.promise;
      aborted = signal?.aborted ?? false;
      return sections;
    },
  });
  const abort = new AbortController();
  const firstProgress: unknown[] = [];
  const secondProgress: unknown[] = [];
  const first = registry.getSections(owner, "content", {
    projectId: "a",
    signal: abort.signal,
    onProgress: (value) => firstProgress.push(value),
  });
  const firstResult = first.then(
    () => "accepted",
    () => "aborted",
  );
  const second = registry.getSections(owner, "content", {
    projectId: "a",
    onProgress: (value) => secondProgress.push(value),
  });
  await Bun.sleep(0);
  try {
    expect(calls).toBe(1);
    expect(firstProgress).toHaveLength(1);
    expect(secondProgress).toHaveLength(1);
    abort.abort();
  } finally {
    gate.resolve();
    await second;
    await firstResult;
  }
  expect(await firstResult).toBe("aborted");
  expect(aborted).toBe(false);
});

test("retired navigation nodes cannot call a replaced provider", async () => {
  const registry = createNavigationTreeRegistry();
  let children = 0;
  const registration = registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getSections: () => sections,
    getChildren: () => {
      children++;
      return [];
    },
  });
  const node = (await registry.getSections(owner, "content", { projectId: "a" }))[0].nodes[0];
  registration.dispose();
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getSections: () => [],
  });
  await expect(registry.getChildren(node, { projectId: "a" })).rejects.toThrow("retired");
  expect(children).toBe(0);
});

test("navigation retention uses the common finite query owner and its bound", async () => {
  const queries = createScopedQueryClient({ runtimeId: "navigation", extensionId: "pstdio" }, { maxInactive: 2 });
  const registry = createNavigationTreeRegistry({ queries });
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getSections: () => sections,
  });
  for (let index = 0; index < 4; index++) await registry.getSections(owner, "content", { projectId: String(index) });
  expect(queries.inspect().retained).toBe(2);
  expect(registry.getStructure(owner, "content", { projectId: "0" })).toEqual([]);
  expect(registry.getStructure(owner, "content", { projectId: "3" })).toHaveLength(1);
  queries.dispose();
});

test.each([
  false,
  true,
])("resource-only project scopes retire navigation rows even when resolved away: %s", async (hideResource) => {
  const queries = createScopedQueryClient({ runtimeId: "navigation", extensionId: "pstdio" });
  const projects: (string | undefined)[] = [];
  const registry = createNavigationTreeRegistry({ queries });
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    resolveResource: hideResource ? () => undefined : undefined,
    getSections: (context) => {
      projects.push(context.projectId);
      return sections;
    },
  });
  const context = { resource: { type: "document", id: "one", projectId: "a" } };
  await registry.getSections(owner, "content", context);
  expect(projects).toEqual(["a"]);
  queries.clearScope({ projectId: "a" });
  expect(registry.getStructure(owner, "content", context)).toEqual([]);
  expect(queries.inspect().retained).toBe(0);
  registry.dispose?.();
  queries.dispose();
});

test("navigation moves reject another project's target under the same live provider", async () => {
  let moves = 0;
  const registry = createNavigationTreeRegistry({
    getViewSections: () => [{ id: "notes", nodes: [{ id: "one", label: "One", canDrag: true, canDrop: true }] }],
    moveViewNode: () => {
      moves++;
    },
  });
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    viewId: "notes",
  });
  const a = (await registry.getSections(owner, "content", { projectId: "a" }))[0].nodes[0];
  const b = (
    await registry.getSections(owner, "content", { resource: { type: "document", id: "one", projectId: "b" } })
  )[0].nodes[0];
  await expect(registry.moveNode(a, b, { projectId: "a" })).rejects.toThrow("another project");
  expect(moves).toBe(0);
  await registry.moveNode(a, a, {});
  expect(moves).toBe(1);
  registry.dispose?.();
});

test("navigation view hints invalidate only their project and keep warm rows during catch-up", async () => {
  let refresh: (event?: QueryChangeEnvelope) => void = () => {};
  const calls: (string | undefined)[] = [];
  const registry = createNavigationTreeRegistry({
    subscribeViewRefresh: (_viewId, listener) => {
      refresh = listener;
      return { dispose: () => {} };
    },
    getViewSections: (_viewId, context) => {
      calls.push(context.projectId);
      return sections;
    },
  });
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    viewId: "notes",
  });
  await registry.getSections(owner, "content", { projectId: "a" });
  await registry.getSections(owner, "content", { projectId: "b" });
  refresh({ projectId: "a" });
  expect(calls).toEqual(["a", "b"]);
  expect(registry.getStructure(owner, "content", { projectId: "a" })).toHaveLength(1);
  await registry.getSections(owner, "content", { projectId: "b" });
  expect(calls).toEqual(["a", "b"]);
  await registry.getSections(owner, "content", { projectId: "a" });
  expect(calls).toEqual(["a", "b", "a"]);
  registry.dispose?.();
});

test("duplicate child reads share their captured project and reject nodes from another project", async () => {
  const registry = createNavigationTreeRegistry();
  const gate = Promise.withResolvers<void>();
  const calls: (string | undefined)[] = [];
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getSections: () => sections,
    async getChildren(_node, context) {
      calls.push(context.projectId);
      await gate.promise;
      return [{ id: "child", label: "Child" }];
    },
  });
  const node = (await registry.getSections(owner, "content", { projectId: "a" }))[0].nodes[0];
  const first = registry.getChildren(node, { projectId: "a" });
  const second = registry.getChildren(node, { projectId: "a" });
  await Bun.sleep(0);
  try {
    expect(calls).toEqual(["a"]);
  } finally {
    gate.resolve();
  }
  expect(await first).toEqual(await second);
  await expect(registry.getChildren(node, { projectId: "b" })).rejects.toThrow("another project");
  expect(calls).toEqual(["a"]);
  registry.dispose?.();
});

test("retiring a pending navigation read fences progress and waits for its actual child", async () => {
  const registry = createNavigationTreeRegistry();
  const gate = Promise.withResolvers<void>();
  let progress: ((value: typeof sections) => void) | undefined;
  const registration = registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    async getSections(context) {
      progress = context.onProgress;
      await gate.promise;
      return sections;
    },
  });
  let settled = false;
  const accepted: unknown[] = [];
  const pending = registry
    .getSections(owner, "content", { projectId: "a", onProgress: (value) => accepted.push(value) })
    .then(
      () => {
        settled = true;
        return "accepted";
      },
      () => {
        settled = true;
        return "retired";
      },
    );
  await Bun.sleep(0);
  registration.dispose();
  progress?.(sections);
  await Bun.sleep(0);
  try {
    expect(settled).toBe(false);
    expect(accepted).toEqual([]);
  } finally {
    gate.resolve();
  }
  expect(await pending).toBe("retired");
  expect(registry.getStructure(owner, "content", { projectId: "a" })).toEqual([]);
  registry.dispose?.();
});

test.each([
  "registration",
  "source",
])("navigation registration owns its source before %s publication can retire the registry", (publication) => {
  let sources = 0;
  const registry = createNavigationTreeRegistry({
    getViewSections: () => [],
    subscribeViewRefresh: (_viewId, listener) => {
      sources++;
      if (publication === "source") listener();
      return {
        dispose: () => {
          sources--;
        },
      };
    },
  });
  registry.onDidChange(() => registry.dispose?.());
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    viewId: "notes",
  });
  expect(registry.resolveOwner("mode", "project")).toBeUndefined();
  expect(sources).toBe(0);
});
