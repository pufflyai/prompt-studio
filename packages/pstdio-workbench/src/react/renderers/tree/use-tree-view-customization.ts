import {
  buildTreeVisibilityMenuActions,
  filterVisibleSections,
  type ResourceContextAction,
  type TreeListSection,
  useTreeListVisibilityStore,
} from "@pstdio/ui";
import type { ReactNode } from "react";

interface TreeViewCustomization {
  // Sections with hidden nodes/sections removed — what the tree actually renders.
  visibleSections: TreeListSection[];
  // Back-of-tree right-click menu: every declared node, checked when visible.
  backgroundContextActions: ResourceContextAction[];
}

// Wires the generic @pstdio/ui visibility primitives onto a single tree host.
// Visibility is persisted per `storageKey`, so each tree view customizes
// independently. The menu is built from the unfiltered sections so hidden
// entries stay listed (unchecked) and can be brought back.
export const useTreeViewCustomization = (
  storageKey: string,
  sections: TreeListSection[],
  checkmark: ReactNode,
): TreeViewCustomization => {
  const sectionOverrides = useTreeListVisibilityStore(storageKey, (state) => state.sectionOverrides);
  const nodeOverrides = useTreeListVisibilityStore(storageKey, (state) => state.nodeOverrides);
  const toggleSection = useTreeListVisibilityStore(storageKey, (state) => state.toggleSection);
  const toggleNode = useTreeListVisibilityStore(storageKey, (state) => state.toggleNode);
  const reset = useTreeListVisibilityStore(storageKey, (state) => state.reset);

  const visibleSections = filterVisibleSections(sections, sectionOverrides, nodeOverrides);
  const backgroundContextActions = buildTreeVisibilityMenuActions(
    sections,
    sectionOverrides,
    nodeOverrides,
    { onToggleSection: toggleSection, onToggleNode: toggleNode, onResetAll: reset },
    { checkmark },
  );

  return { visibleSections, backgroundContextActions };
};
