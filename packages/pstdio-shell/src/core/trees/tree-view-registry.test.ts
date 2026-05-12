import { describe, expect, test } from "bun:test";
import { createTreeViewRegistry } from "./tree-view-registry";

describe("createTreeViewRegistry", () => {
  test("registers tree views and delegates node loading to the contribution", async () => {
    const trees = createTreeViewRegistry();

    trees.registerTreeView({
      id: "sessions.tree",
      title: "Sessions",
      area: "left",
      getRoots: async () => [
        {
          id: "s1",
          label: "Session 1",
          resource: { kind: "session", uri: "pstdio://session/s1" },
          collapsible: true,
        },
      ],
      getChildren: async (node) => [{ id: `${node.id}:log`, label: "Log" }],
    });

    await expect(trees.getRoots("sessions.tree")).resolves.toMatchObject([{ id: "s1", label: "Session 1" }]);
    await expect(trees.getChildren("sessions.tree", { id: "s1", label: "Session 1" })).resolves.toMatchObject([
      { id: "s1:log", label: "Log" },
    ]);
  });
});
