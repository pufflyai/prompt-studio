import { expect, test } from "bun:test";
import { createNavigationTreeRegistry } from "./navigation-tree-registry";

const owner = { kind: "mode", id: "sessions", extensionId: "pstdio" } as const;
const first = { type: "session", id: "first" };
const second = { type: "session", id: "second" };

test("shared navigation reads and identifies the same resource scope across selection changes", async () => {
  const registry = createNavigationTreeRegistry();
  const resources: unknown[] = [];
  registry.registerContribution({
    id: "session-list",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    resolveResource: () => undefined,
    getSections: ({ resource }) => {
      resources.push(resource);
      return [{ id: "sessions", nodes: [{ id: "folder", label: "Sessions" }] }];
    },
    getChildren: (_node, { resource }) => {
      resources.push(resource);
      return [];
    },
  });
  expect(registry.getReadKey(owner, { resource: first })).toBe(registry.getReadKey(owner, { resource: second }));
  const sections = await registry.getSections(owner, "content", { resource: first });
  await registry.getSections(owner, "content", { resource: second });
  await registry.getChildren(sections[0].nodes[0], { resource: second });
  expect(resources).toEqual([undefined, undefined, undefined]);
});

test("resource-dependent contributions retain isolation even beside shared navigation", () => {
  const registry = createNavigationTreeRegistry();
  registry.registerContribution({
    id: "shared",
    owner,
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    resolveResource: () => undefined,
    getSections: () => [],
  });
  const sharedKey = registry.getReadKey(owner, { resource: first });
  const dependent = registry.registerContribution({
    id: "resource-actions",
    owner,
    sourceExtensionId: "extension",
    declarationIndex: 0,
    getSections: () => [],
  });
  expect(registry.getReadKey(owner, { resource: first })).not.toBe(sharedKey);
  expect(registry.getReadKey(owner, { resource: first })).not.toBe(registry.getReadKey(owner, { resource: second }));
  dependent.dispose();
  expect(registry.getReadKey(owner, { resource: first })).toBe(sharedKey);
});
