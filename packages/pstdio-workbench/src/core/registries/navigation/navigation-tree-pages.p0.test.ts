import { expect, test } from "bun:test";
import { createNavigationTreeRegistry } from "./navigation-tree-registry";

test("later Sidenav pages keep scoped IDs and provider ownership for child expansion", async () => {
  const owner = { kind: "page" as const, id: "sessions", extensionId: "history" };
  const queries: unknown[] = [];
  const registry = createNavigationTreeRegistry({
    getViewSections: () => [
      {
        id: "sessions",
        nodes: [],
        nextPage: async () => ({ nodes: [{ id: "older", label: "Older", collapsible: true }] }),
      },
    ],
    getViewChildren: (view, node, context) => {
      queries.push({ view, node, resource: context.resource });
      return [{ id: "child", label: "Child" }];
    },
  });
  registry.registerContribution({
    id: "history",
    idScope: "history",
    owner,
    sourceExtensionId: "history",
    declarationIndex: 0,
    viewId: "history-view",
  });
  const resource = { type: "workspace", id: "w" };
  const sections = await registry.getSections(owner, "content", { resource });
  const page = await sections[0]!.nextPage!(new AbortController().signal);
  expect(page.nodes[0]!.id).toBe("history:older");
  const children = await registry.getChildren(page.nodes[0]!);
  expect(children[0]!.id).toBe("history:child");
  expect(queries).toEqual([
    { view: "history-view", node: { id: "older", label: "Older", collapsible: true }, resource },
  ]);
});

test("escaped continuation loaders cannot invoke or publish a retired provider", async () => {
  const owner = { kind: "page" as const, id: "sessions", extensionId: "history" };
  let calls = 0;
  const pending = Promise.withResolvers<{ nodes: { id: string; label: string }[] }>();
  const registry = createNavigationTreeRegistry();
  const contribution = {
    id: "history",
    owner,
    sourceExtensionId: "history",
    declarationIndex: 0,
    getSections: () => [
      {
        id: "sessions",
        nodes: [],
        nextPage: async () => {
          calls++;
          return pending.promise;
        },
      },
    ],
  };
  const registration = registry.registerContribution(contribution);
  const page = (await registry.getSections(owner))[0]!.nextPage!;
  const entered = page(new AbortController().signal).catch((error) => error);
  registration.dispose();
  registry.registerContribution(contribution);
  await expect(page(new AbortController().signal)).rejects.toThrow("retired");
  expect(calls).toBe(1);
  pending.resolve({ nodes: [{ id: "late", label: "late" }] });
  expect((await entered).name).toBe("AbortError");
  registry.dispose?.();
});

test("merged continuation failure aborts and drains every issued sibling before retry", async () => {
  const { mergeNavigationTreePages } = await import("./navigation-tree-pages");
  const child = Promise.withResolvers<{ nodes: never[] }>();
  let signal!: AbortSignal;
  let completed = false;
  const load = mergeNavigationTreePages(
    async () => {
      throw new Error("offline");
    },
    async (input) => {
      signal = input;
      return child.promise;
    },
  )!;
  const result = load(new AbortController().signal).catch((error) => {
    completed = true;
    return error;
  });
  await Bun.sleep(0);
  expect(signal.aborted).toBe(true);
  expect(completed).toBe(false);
  child.resolve({ nodes: [] });
  expect((await result).message).toBe("offline");
});
