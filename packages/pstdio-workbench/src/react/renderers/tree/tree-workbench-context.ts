import { useEffect } from "react";
import type { TreeViewSection, WorkbenchCore } from "../../../core";
import { boundedResource, setWorkbenchSelection } from "../../../core/workbench-context";

export const useTreeWorkbenchContext = (
  workbench: WorkbenchCore,
  selectionOwner: string | undefined,
  projectId: string | undefined,
  selection: {
    selectedId?: string | null;
    sections: TreeViewSection[];
    childrenByNodeId: Record<string, import("../../../core/registries/renderers/tree-renderer-types").TreeNode[]>;
  },
) => {
  useEffect(() => {
    if (!selectionOwner || !projectId) return;
    const pending = selection.selectedId ? selection.sections.flatMap((section) => section.nodes) : [];
    let item: ReturnType<typeof boundedResource>;
    while (pending.length) {
      const node = pending.pop()!;
      if (node.id === selection.selectedId) {
        item = boundedResource(node.resource, projectId);
        break;
      }
      pending.push(...(selection.childrenByNodeId[node.id] ?? node.children ?? []));
    }
    setWorkbenchSelection(workbench, selectionOwner, item ? { kind: "resources", items: [item] } : { kind: "none" });
  }, [projectId, selectionOwner, workbench, selection]);
  useEffect(
    () => () => {
      if (selectionOwner) setWorkbenchSelection(workbench, selectionOwner);
    },
    [workbench, selectionOwner],
  );
};
