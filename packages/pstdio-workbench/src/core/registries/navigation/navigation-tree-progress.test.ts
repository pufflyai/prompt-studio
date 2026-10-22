import { expect, test } from "bun:test";
import { createNavigationTreeRegistry } from "./navigation-tree-registry";

test("ready contributions appear before slower siblings and retain their declared order", async () => {
  const registry = createNavigationTreeRegistry();
  const owner = { kind: "page", id: "ticket", extensionId: "planner" } as const;
  const pending = Promise.withResolvers<void>();
  for (const [index, id] of ["files", "sessions"].entries()) {
    registry.registerContribution({
      id,
      owner,
      sourceExtensionId: "planner",
      declarationIndex: index,
      getSections: async () => {
        if (id === "files") await pending.promise;
        return [{ id: "ticket", nodes: [{ id, label: id }] }];
      },
    });
  }
  const published: string[][] = [];
  const reading = registry.getSections(owner, "content", {
    onProgress: (sections) => published.push(sections.flatMap((section) => section.nodes.map((node) => node.id))),
  });
  await Bun.sleep(0);
  try {
    expect(published).toEqual([["sessions"]]);
  } finally {
    pending.resolve();
  }
  expect((await reading).flatMap((section) => section.nodes.map((node) => node.id))).toEqual(["files", "sessions"]);
  expect(published.at(-1)).toEqual(["files", "sessions"]);
});
