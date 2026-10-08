import { useEffect, useRef } from "react";
import { getWorkbenchRenderers, type WorkbenchCore } from "../../../core";
import { resolveTreeListSelection } from "./tree-list-adapter";
import { treeSelectionAncestors } from "./tree-selection-ancestors";

export const useTreeSelection = (
  workbench: WorkbenchCore,
  treeViewId: string,
  input: Parameters<typeof resolveTreeListSelection>[0],
) => {
  const { sections, childrenByNodeId } = input;
  const selectedNodeIds = resolveTreeListSelection(input);
  const ids = typeof selectedNodeIds === "string" ? [selectedNodeIds] : (selectedNodeIds ?? []);
  const key = JSON.stringify([treeViewId, ids]);
  const revealed = useRef<string | null>(null);
  useEffect(() => {
    if (!ids.length) {
      revealed.current = null;
      return;
    }
    if (revealed.current === key) return;
    const ancestors = treeSelectionAncestors(sections, childrenByNodeId, ids);
    if (!ancestors) return;
    revealed.current = key;
    const trees = getWorkbenchRenderers(workbench);
    for (const id of ancestors.nodes) trees.setNodeExpanded(treeViewId, id, true);
    for (const id of ancestors.sections) trees.setSectionExpanded(treeViewId, id, true);
  }, [workbench, treeViewId, key, ids, sections, childrenByNodeId]);
  return selectedNodeIds;
};
