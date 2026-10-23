import { expect, test } from "bun:test";
import { createNavigationTreeRegistry, type NavigationTreeContext } from "./navigation-tree-registry";

const owner = { kind: "mode", extensionId: "pstdio", id: "project" } as const;
const notes = [{ id: "notes", nodes: [{ id: "note", label: "Notes" }] }];
const fixture = () => {
  const registry = createNavigationTreeRegistry();
  const registration = registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getSections: () => notes,
  });
  return { registry, registration };
};

test("loaded navigation is available before a returning owner's next read", async () => {
  const { registry } = fixture();
  const context = { projectId: "one", resource: { type: "workspace", id: "first" } };
  const loaded = await registry.getSections(owner, "content", context);
  expect(registry.getStructure(owner, "content", context)).toEqual(loaded);
});

test("navigation snapshots belong to their project and resolved resource", async () => {
  const { registry } = fixture();
  const context: NavigationTreeContext = { projectId: "one", resource: { type: "workspace", id: "first" } };
  await registry.getSections(owner, "content", context);
  expect(registry.getStructure(owner, "content", { ...context, projectId: "two" })).toEqual([]);
  expect(
    registry.getStructure(owner, "content", { ...context, resource: { type: "workspace", id: "second" } }),
  ).toEqual([]);
});

test("navigation refresh keeps resolved rows while another contribution finishes", async () => {
  const registry = createNavigationTreeRegistry();
  const pending = Promise.withResolvers<void>();
  let refreshing = false;
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getSections: async ({ onProgress }) => {
      if (refreshing) {
        onProgress?.([]);
        await pending.promise;
      }
      return notes;
    },
  });
  registry.registerContribution({
    id: "home",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 1,
    getSections: () => [{ id: "home", nodes: [{ id: "home", label: "Home" }] }],
  });
  const loaded = await registry.getSections(owner);
  refreshing = true;
  const progress: unknown[] = [];
  const reading = registry.getSections(owner, "content", { onProgress: (sections) => progress.push(sections) });
  await Bun.sleep(0);
  try {
    expect(progress.length).toBeGreaterThan(0);
    for (const snapshot of progress) expect(snapshot).toEqual(loaded);
  } finally {
    pending.resolve();
    await reading;
  }
});

test("removing a contribution clears its navigation snapshot", async () => {
  const { registry, registration } = fixture();
  await registry.getSections(owner);
  registration.dispose();
  registry.registerContribution({
    id: "notes",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getSections: () => [],
  });
  expect(registry.getStructure(owner)).toEqual([]);
});
