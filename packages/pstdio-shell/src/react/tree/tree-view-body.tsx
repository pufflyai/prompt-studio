import { Skeleton, Stack } from "@chakra-ui/react";
import { EmptyState, TreeList, type TreeListSection } from "@pstdio/ui";
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
  activeNodeId: string | string[] | undefined;
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onToggleSection: (sectionId: string) => void;
  onToggleNode: (nodeId: string) => void;
  onNavigate: (event: Parameters<NonNullable<Parameters<typeof TreeList>[0]["onNavigate"]>>[0]) => void;
}

export const TreeViewBody = (props: TreeViewBodyProps) => {
  const {
    loading,
    moduleLoading,
    sections,
    activeNodeId,
    expandedNodeIds,
    expandedSectionIds,
    scrollRef,
    onToggleSection,
    onToggleNode,
    onNavigate,
  } = props;

  if (loading) return null;
  if (moduleLoading) return <TreeViewSkeleton />;

  if (sections.length === 0) return <EmptyState minH="12rem" title="No tree items" />;

  return (
    <TreeList
      sections={sections}
      expandedNodeIds={expandedNodeIds}
      expandedSectionIds={expandedSectionIds}
      activeNodeId={activeNodeId}
      rowVariant="compact"
      sectionGap="md"
      virtualize={canVirtualizeTreeSections(sections)}
      scrollRef={scrollRef}
      onToggleSection={onToggleSection}
      onToggleNode={onToggleNode}
      onNavigate={onNavigate}
    />
  );
};
