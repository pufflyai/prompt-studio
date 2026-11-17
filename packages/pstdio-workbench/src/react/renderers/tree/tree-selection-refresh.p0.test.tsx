import { expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers, type TreeNode, type TreeViewSection } from "../../../core";
import { useTreeData } from "./use-tree-data";

test("opening a nested document retains expanded rows throughout its tree refresh", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const held = Promise.withResolvers<TreeViewSection[]>();
  const folder = { id: "folder", label: "Folder", collapsible: true };
  let roots = 0;
  workbench.views.registerView({
    id: "files",
    title: "Files",
    body: {
      kind: "tree",
      getReadKey: (ctx) => String(ctx.resource?.metadata?.path),
      getBody: () => (++roots === 1 ? [{ id: "files", nodes: [folder] }] : held.promise),
      getChildren: (node) =>
        node.id === "folder"
          ? [{ id: "nested", label: "Nested", collapsible: true }]
          : [{ id: "document", label: "Document" }],
    },
  });
  let value: ReturnType<typeof useTreeData> | undefined;
  const snapshots: string[][] = [];
  const Capture = ({ path, workspace = "one" }: { path: string; workspace?: string }) => {
    value = useTreeData(workbench, "files", { type: "workspace", id: workspace, metadata: { path } });
    const ids = (nodes: TreeNode[]): string[] => nodes.flatMap((node) => [node.id, ...ids(node.children ?? [])]);
    snapshots.push(value.body.flatMap((section) => ids(section.nodes)));
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Capture path="first" />);
    });
    await act(async () => {
      getWorkbenchRenderers(workbench).setNodeExpanded("files", "folder", true);
      getWorkbenchRenderers(workbench).setNodeExpanded("files", "nested", true);
    });
    expect(snapshots.at(-1)).toEqual(["folder", "nested", "document"]);
    snapshots.length = 0;
    await act(async () => renderer!.update(<Capture path="folder/nested/document" />));
    expect(value?.loading).toBe(true);
    expect(snapshots.every((ids) => ids.includes("document"))).toBe(true);
    await act(async () => held.resolve([{ id: "files", nodes: [folder] }]));
    expect(value?.loading).toBe(false);
    expect(snapshots.every((ids) => ids.includes("document"))).toBe(true);
    snapshots.length = 0;
    await act(async () => renderer!.update(<Capture path="other" workspace="two" />));
    expect(snapshots[0]).toEqual([]);
  } finally {
    held.resolve([]);
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
