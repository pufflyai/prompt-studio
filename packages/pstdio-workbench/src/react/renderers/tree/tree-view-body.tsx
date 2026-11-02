import { Skeleton, Stack } from "@chakra-ui/react";
import {
  EmptyState,
  type ResourceContextAction,
  TreeList,
  type TreeListMovePolicy,
  type TreeListSection,
} from "@pstdio/ui";
import type { ReactNode, RefObject } from "react";

const TREE_SKELETON_WIDTHS = ["70%", "50%", "82%", "60%", "44%", "76%"];

const TreeViewSkeleton = () => (
  <Stack gap="sm" px="sm" py="xs" aria-hidden>
    {TREE_SKELETON_WIDTHS.map((width, index) => (
      <Skeleton key={`${width}-${index}`} height="4" width={width} borderRadius="xs" />
    ))}
  </Stack>
);

interface TreeViewBodyProps {
  error?: string | null;
  loading: boolean;
  moduleLoading?: boolean;
  sections: TreeListSection[];
  leadingContent?: ReactNode;
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
  canMove?: TreeListMovePolicy;
  onMoveNode?: (sourceNodeId: string, targetNodeId?: string, position?: "before" | "after" | "inside") => void;
  onNavigate: (event: Parameters<NonNullable<Parameters<typeof TreeList>[0]["onNavigate"]>>[0]) => void;
}

export const TreeViewBody = (props: TreeViewBodyProps) => {
  const {
    error,
    loading,
    moduleLoading,
    sections,
    leadingContent,
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
    canMove,
    onMoveNode,
    onNavigate,
  } = props;

  if ((error || loading) && sections.length === 0) return <TreeList sections={[]} leadingContent={leadingContent} />;
  if (moduleLoading)
    return (
      <TreeList
        sections={[]}
        leadingContent={
          <>
            {leadingContent}
            <TreeViewSkeleton />
          </>
        }
      />
    );

  // Keep an empty-but-customizable tree right-clickable so a fully-hidden tree
  // can still be restored from the back-of-tree menu.
  if (sections.length === 0 && (backgroundContextActions?.length ?? 0) === 0 && !customizationAvailable) {
    return <EmptyState minH="12rem" title="No tree items" />;
  }

  return (
    <TreeList
      sections={sections}
      leadingContent={leadingContent}
      backgroundContextActions={backgroundContextActions}
      draggable={draggable}
      expandedNodeIds={expandedNodeIds}
      expandedSectionIds={expandedSectionIds}
      activeNodeId={activeNodeId}
      rowVariant="compact"
      sectionGap="md"
      nodeGap="1px"
      // Late children and inline editors must not switch renderers and remount open menus.
      virtualize
      scrollRef={scrollRef}
      onToggleSection={onToggleSection}
      onToggleNode={onToggleNode}
      onReorderSections={onReorderSections}
      onReorderNodes={onReorderNodes}
      canMove={canMove}
      onMoveNode={onMoveNode}
      onNavigate={onNavigate}
    />
  );
};
