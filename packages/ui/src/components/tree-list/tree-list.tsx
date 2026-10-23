import { Box, Stack, type StackProps } from "@chakra-ui/react";
import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from "react";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import type { TreeListLinkComponent, TreeListNavigateEvent, TreeListSection } from "./tree-list.types";
import { TreeListBackground } from "./tree-list-background";
import { buildVirtualRows } from "./tree-list-model";
import { TreeListMoveSurface } from "./tree-list-move-surface";
import { TreeListNodes } from "./tree-list-nodes";
import type { TreeListMovePolicy } from "./tree-list-reorder";
import { TreeListReveal } from "./tree-list-reveal";
import { TreeListRow } from "./tree-list-row";
import { TreeListSelectionProvider } from "./tree-list-selection-context";
import { TreeListSortable } from "./tree-list-sortable";
import { VirtualTreeList } from "./tree-list-virtual";
import { useTreeListKeyboardNavigation } from "./use-tree-list-keyboard-navigation";

export { buildVirtualRows } from "./tree-list-model";

type TreeListRowVariant = "compact" | "tree";

/** Sectioned hierarchical list for files, resources, navigation, and customizable sidenavs. */
export interface TreeListProps {
  /** Ordered sections to render, each containing nested tree nodes. */
  sections: TreeListSection[];
  /** Fixed content before the customizable rows, inside the shared list inset. */
  leadingContent?: ReactNode;
  /** Controlled section ids that are currently expanded. */
  expandedSectionIds?: string[];
  /** Controlled node ids that are currently expanded. */
  expandedNodeIds?: string[];
  /** Active node id, or ids, used for selection styling. */
  activeNodeId?: string | string[] | null;
  /** Controlled multiselection: click replaces, Ctrl/Cmd toggles, Shift extends a visible range.
   * Space/Enter select; Shift+Up/Down extends; Alt+Up/Down emits a sibling move through onMoveNode.
   * The host decides whether a move applies to the source or the selected set. */
  onSelectionChange?: (nodeIds: string[]) => void;
  /** Compact rows suit app navigation; tree rows suit file/resource hierarchies. */
  rowVariant?: TreeListRowVariant;
  sectionGap?: StackProps["gap"];
  nodeGap?: StackProps["gap"];
  /** Link renderer used when nodes provide `href`. */
  linkComponent?: TreeListLinkComponent;
  /** Called when a navigable node is activated. */
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleSection?: (sectionId: string) => void;
  onToggleNode?: (nodeId: string) => void;
  onSectionContextMenu?: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
  /** Render large trees with virtual rows, including customizable navigation. */
  virtualize?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  // Hosts persist customization moves; virtualization keeps visible rows mounted.
  draggable?: boolean;
  onReorderSections?: (nextSectionIds: string[]) => void;
  onReorderNodes?: (sectionId: string, nextNodeIds: string[]) => void;
  /** Decide whether a proposed customization move is valid. */
  canMove?: TreeListMovePolicy;
  /** Move a node before/after a leaf, into a container, or into the background when the target is omitted. */
  onMoveNode?: (sourceNodeId: string, targetNodeId?: string, position?: "before" | "after" | "inside") => void;
  // Background actions sit behind item rows, which keep their own context menu.
  backgroundContextActions?: ResourceContextAction[];
}

const StackTreeList = (props: TreeListProps) => {
  const {
    sections,
    expandedSectionIds = [],
    expandedNodeIds = [],
    activeNodeId,
    rowVariant = "tree",
    sectionGap = "0",
    nodeGap = "0",
    linkComponent,
    onNavigate,
    onToggleSection,
    onToggleNode,
    onSectionContextMenu,
    onMoveNode,
    virtualize,
    scrollRef,
  } = props;
  const rows = buildVirtualRows(sections, expandedSectionIds, expandedNodeIds);
  const keyboard = useTreeListKeyboardNavigation({
    rows,
    activeNodeId,
    expandedNodeIds,
    onToggleNode,
    onToggleSection,
  });

  if (virtualize && scrollRef) {
    return <VirtualTreeList {...props} rows={rows} scrollRef={scrollRef} />;
  }

  return (
    <Stack
      ref={keyboard.rootRef}
      role="listbox"
      aria-multiselectable={Boolean(props.onSelectionChange) || undefined}
      gap={sectionGap}
      w="full"
      minW="0"
      maxW="full"
      overflowX="hidden"
      onKeyDown={keyboard.handleKeyDown}
    >
      {sections.map((section) => {
        const sectionRows = rows.filter((row) => row.sectionId === section.id);

        return (
          <Stack
            key={section.id}
            gap={nodeGap}
            w="full"
            minW="0"
            maxW="full"
            data-testid={`tree-list-section-${section.id}`}
          >
            {sectionRows
              .filter((row) => row.kind === "section-header")
              .map((row) => (
                <Box key={row.key} w="full" minW="0">
                  <TreeListRow
                    row={row}
                    expandedNodeIds={expandedNodeIds}
                    activeNodeId={activeNodeId}
                    focusRowId={keyboard.focusRowId}
                    rowVariant={rowVariant}
                    nodeGap={nodeGap}
                    linkComponent={linkComponent}
                    onRowFocus={keyboard.onRowFocus}
                    onNavigate={onNavigate}
                    onToggleSection={onToggleSection}
                    onToggleNode={onToggleNode}
                    onSectionContextMenu={onSectionContextMenu}
                    onMoveNode={onMoveNode}
                  />
                </Box>
              ))}
            <TreeListReveal
              open={
                section.collapsible === false || section.label === undefined || expandedSectionIds.includes(section.id)
              }
            >
              <TreeListNodes
                sectionId={section.id}
                nodes={section.nodes}
                expandedNodeIds={expandedNodeIds}
                activeNodeId={activeNodeId}
                focusRowId={keyboard.focusRowId}
                onRowFocus={keyboard.onRowFocus}
                rowVariant={rowVariant}
                nodeGap={nodeGap}
                linkComponent={linkComponent}
                onNavigate={onNavigate}
                onToggleNode={onToggleNode}
                onMoveNode={onMoveNode}
              />
              {section.nodes.length === 0 ? section.emptyState : null}
            </TreeListReveal>
          </Stack>
        );
      })}
    </Stack>
  );
};

export const TreeList = (props: TreeListProps) => {
  const content = props.draggable ? (
    <TreeListSortable
      virtualize={props.virtualize}
      scrollRef={props.scrollRef}
      sections={props.sections}
      expandedSectionIds={props.expandedSectionIds}
      expandedNodeIds={props.expandedNodeIds}
      activeNodeId={props.activeNodeId}
      rowVariant={props.rowVariant}
      sectionGap={props.sectionGap}
      nodeGap={props.nodeGap}
      linkComponent={props.linkComponent}
      onNavigate={props.onNavigate}
      onToggleSection={props.onToggleSection}
      onToggleNode={props.onToggleNode}
      onSectionContextMenu={props.onSectionContextMenu}
      onReorderSections={props.onReorderSections}
      onReorderNodes={props.onReorderNodes}
      onMoveNode={props.onMoveNode}
      canMove={props.canMove}
    />
  ) : (
    <StackTreeList {...props} />
  );
  const paddedContent = (
    <TreeListSelectionProvider tree={props}>
      <TreeListMoveSurface onMoveNode={props.onMoveNode}>
        {props.leadingContent}
        {content}
      </TreeListMoveSurface>
    </TreeListSelectionProvider>
  );

  if (!props.backgroundContextActions || props.backgroundContextActions.length === 0) {
    return paddedContent;
  }

  return <TreeListBackground actions={props.backgroundContextActions}>{paddedContent}</TreeListBackground>;
};
