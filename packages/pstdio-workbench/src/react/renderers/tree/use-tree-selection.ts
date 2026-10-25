import { useEffect, useRef } from "react";
import { getWorkbenchRenderers, getWorkbenchSelectionResourceKeys, type WorkbenchCore } from "../../../core";
import { resolveTreeListSelection, resolveTreeSelectionIntent } from "./tree-list-selection";
import { treeSelectionAncestors } from "./tree-selection-ancestors";

export const useTreeSelection = (
  workbench: WorkbenchCore,
  treeViewId: string,
  input: Parameters<typeof resolveTreeListSelection>[0],
) => {
  const { sections, childrenByNodeId } = input;
  const selectedNodeIds = resolveTreeListSelection(input);
  const ids = typeof selectedNodeIds === "string" ? [selectedNodeIds] : (selectedNodeIds ?? []);
  const context = JSON.stringify([
    treeViewId,
    input.activeNodeId,
    input.activeResource ? getWorkbenchSelectionResourceKeys(input.activeResource) : input.activeLocation,
    input.activeResource || input.activeLocation ? undefined : ids,
  ]);
  const key = JSON.stringify(ids);
  const intent = resolveTreeSelectionIntent(input);
  const revealed = useRef({ context, intent: undefined as string | undefined, selections: new Set<string>() });
  useEffect(() => {
    if (revealed.current.context !== context) revealed.current = { context, intent: undefined, selections: new Set() };
    if (intent && revealed.current.intent !== intent) revealed.current = { context, intent, selections: new Set() };
    // Partial reads can temporarily select the page before its resource row returns.
    // Revealing each selection once in its navigation context preserves a user's collapse.
    if (!ids.length || revealed.current.selections.has(key)) return;
    const ancestors = treeSelectionAncestors(sections, childrenByNodeId, ids);
    if (!ancestors) return;
    revealed.current.selections.add(key);
    const trees = getWorkbenchRenderers(workbench);
    for (const id of ancestors.nodes) trees.setNodeExpanded(treeViewId, id, true);
    for (const id of ancestors.sections) trees.setSectionExpanded(treeViewId, id, true);
  }, [workbench, treeViewId, context, key, intent, ids, sections, childrenByNodeId]);
  return selectedNodeIds;
};
