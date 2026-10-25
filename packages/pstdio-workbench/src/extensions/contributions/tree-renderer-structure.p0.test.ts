import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";
import { metadata, treeId } from "./tree-renderer-contributions.fixture";

test("extension section structure and the bound resource are available without a callback", () => {
  const workbench = createWorkbench();
  let reads = 0;
  workbench.registerModule({
    id: "test.structure",
    activate: (context) =>
      registerWorkbenchExtensionTreeRenderers({
        workbench: context,
        projectId: "project",
        executeCommand: () => {
          reads++;
          return [];
        },
        metadata: {
          ...metadata,
          treeRenderers: [
            {
              ...metadata.treeRenderers![0]!,
              structure: [
                { id: "ticket", resourceNode: { id: "self", icon: "Ticket" } },
                { id: "files", label: "Files", collapsible: true },
              ],
            },
          ],
        },
      }),
  });
  const structure = getWorkbenchRenderers(workbench)
    .getTreeRenderer(treeId)
    ?.getStructure?.({
      resource: { type: "ticket", id: "a", label: "Ticket A" },
    });
  expect(structure).toMatchObject([
    { id: "ticket", nodes: [{ id: "self", label: "Ticket A", icon: "Ticket" }] },
    { id: "files", label: "Files", loading: true, nodes: [] },
  ]);
  expect(reads).toBe(0);
});
