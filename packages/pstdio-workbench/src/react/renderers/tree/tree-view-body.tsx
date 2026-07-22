import { Skeleton, Stack } from "@chakra-ui/react";
import { EmptyState, type ResourceContextAction, TreeList, type TreeListSection } from "@pstdio/ui";
import type { RefObject } from "react";
import { canVirtualizeTreeSections } from "./tree-list-adapter";

const TREE_SKELETON_WIDTHS = ["70%", "50%", "82%", "60%", "44%", "76%"];

const TreeViewSkeleton = () => (
  <Stack gap="sm" px="sm" py="xs" aria-hidden>
    {TREE_SKELETON_WIDTHS.map((width, index) => (
      <Skeleton key={`${width}-${index}`} height="4" width={width} borderRadius="xs" />
    ))}
  </Stack>
);

interface TreeViewBodyProps {
  loading: boolean;
  moduleLoading?: boolean;
  sections: TreeListSection[];
  backgroundContextActions?: ResourceContextAction[];
  draggable?: boolean;
  customizationAvailable?: boolean;
  activeNodeId: string | string[] | undefined;
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onToggleSection: (sectionId: string) => void;
  onToggleNode: (nodeId: string) => void;
  onReorderSections?: (nextSectionIds: string[]) => void;
  onReorderNodes?: (sectionId: string, nextNodeIds: string[]) => void;
  onNavigate: (event: Parameters<NonNullable<Parameters<typeof TreeList>[0]["onNavigate"]>>[0]) => void;
}

export const TreeViewBody = (props: TreeViewBodyProps) => {
  const {
    loading,
    moduleLoading,
    sections,
    backgroundContextActions,
    draggable,
    customizationAvailable,
    activeNodeId,
    expandedNodeIds,
    expandedSectionIds,
    scrollRef,
    onToggleSection,
    onToggleNode,
    onReorderSections,
    onReorderNodes,
    onNavigate,
  } = props;

  if (loading) return null;
  if (moduleLoading) return <TreeViewSkeleton />;

  // Keep an empty-but-customizable tree right-clickable so a fully-hidden tree
  // can still be restored from the back-of-tree menu.
  if (sections.length === 0 && (backgroundContextActions?.length ?? 0) === 0 && !customizationAvailable) {
    return <EmptyState minH="12rem" title="No tree items" />;
  }

  return (
    <TreeList
      sections={sections}
      backgroundContextActions={backgroundContextActions}
      draggable={draggable}
      expandedNodeIds={expandedNodeIds}
      expandedSectionIds={expandedSectionIds}
      activeNodeId={activeNodeId}
      rowVariant="compact"
      sectionGap="md"
      nodeGap="1px"
      virtualize={canVirtualizeTreeSections(sections)}
      scrollRef={scrollRef}
      onToggleSection={onToggleSection}
      onToggleNode={onToggleNode}
      onReorderSections={onReorderSections}
      onReorderNodes={onReorderNodes}
      onNavigate={onNavigate}
    />
  );
};
