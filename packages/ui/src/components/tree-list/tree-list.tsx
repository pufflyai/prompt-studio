import { Box, Stack, type StackProps } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import type { TreeListLinkComponent, TreeListNavigateEvent, TreeListSection } from "./tree-list.types";
import { buildVirtualRows, type VirtualRow } from "./tree-list-model";
import { TreeListNodeRow } from "./tree-list-node-row";
import { TreeListSectionHeader } from "./tree-list-section-header";
import { TreeListSortable } from "./tree-list-sortable";
import { useTreeListKeyboardNavigation } from "./use-tree-list-keyboard-navigation";

export { buildVirtualRows } from "./tree-list-model";

type TreeListRowVariant = "compact" | "tree";

interface TreeListProps {
  sections: TreeListSection[];
  expandedSectionIds?: string[];
  expandedNodeIds?: string[];
  activeNodeId?: string | string[] | null;
  rowVariant?: TreeListRowVariant;
  sectionGap?: StackProps["gap"];
  nodeGap?: StackProps["gap"];
  linkComponent?: TreeListLinkComponent;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleSection?: (sectionId: string) => void;
  onToggleNode?: (nodeId: string) => void;
  onSectionContextMenu?: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
  virtualize?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  // When true, sections and items render with drag handles. Virtualization is
  // bypassed (per the ADR) — customizable trees are typically small. Hosts
  // must supply onReorderSections / onReorderNodes to persist the new order.
  draggable?: boolean;
  onReorderSections?: (nextSectionIds: string[]) => void;
  onReorderNodes?: (sectionId: string, nextNodeIds: string[]) => void;
}

const VIRTUAL_ROW_ESTIMATE = 32;
const VIRTUAL_ROW_OVERSCAN = 4;

interface RenderVirtualRowInput {
  row: VirtualRow;
  expandedNodeIds: string[];
  activeNodeId?: string | string[] | null;
  focusRowId?: string;
  rowVariant: TreeListRowVariant;
  nodeGap: StackProps["gap"];
  linkComponent?: TreeListLinkComponent;
  onRowFocus: (rowId: string) => void;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleSection?: (sectionId: string) => void;
  onToggleNode?: (nodeId: string) => void;
  onSectionContextMenu?: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
}

const renderVirtualRow = (input: RenderVirtualRowInput) => {
  const {
    row,
    expandedNodeIds,
    activeNodeId,
    focusRowId,
    rowVariant,
    nodeGap,
    linkComponent,
    onRowFocus,
    onNavigate,
    onToggleSection,
    onToggleNode,
    onSectionContextMenu,
  } = input;

  if (row.kind === "section-header") {
    return (
      <TreeListSectionHeader
        section={row.section}
        collapsible={row.collapsible}
        expanded={row.expanded}
        focusId={row.key}
        tabIndex={row.key === focusRowId ? 0 : -1}
        onFocus={() => onRowFocus(row.key)}
        onToggle={() => onToggleSection?.(row.sectionId)}
        onContextMenu={onSectionContextMenu}
      />
    );
  }

  if (row.kind === "section-empty") return row.emptyState ?? null;

  return (
    <TreeListNodeRow
      sectionId={row.sectionId}
      node={row.node}
      level={row.level}
      expandedNodeIds={expandedNodeIds}
      activeNodeId={activeNodeId}
      rowVariant={rowVariant}
      nodeGap={nodeGap}
      linkComponent={linkComponent}
      tabIndex={row.node.id === focusRowId ? 0 : -1}
      onFocus={() => onRowFocus(row.node.id)}
      onNavigate={onNavigate}
      onToggleNode={onToggleNode}
    />
  );
};

interface VirtualTreeListProps extends TreeListProps {
  rows: VirtualRow[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

const VirtualTreeList = (props: VirtualTreeListProps) => {
  const {
    rows,
    expandedNodeIds = [],
    activeNodeId,
    rowVariant = "tree",
    nodeGap = "0",
    linkComponent,
    onNavigate,
    onToggleSection,
    onToggleNode,
    onSectionContextMenu,
    scrollRef,
  } = props;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE,
    overscan: VIRTUAL_ROW_OVERSCAN,
    getItemKey: (index) => rows[index]?.key ?? index,
  });
  const keyboard = useTreeListKeyboardNavigation({
    rows,
    activeNodeId,
    expandedNodeIds,
    onToggleNode,
    onToggleSection,
    scrollToRow: (index) => virtualizer.scrollToIndex(index, { align: "auto" }),
  });

  return (
    <Box
      ref={keyboard.rootRef}
      role="listbox"
      w="full"
      minW="0"
      maxW="full"
      position="relative"
      style={{ height: virtualizer.getTotalSize() }}
      onKeyDown={keyboard.handleKeyDown}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const row = rows[virtualItem.index];
        if (!row) return null;

        return (
          <Box
            key={virtualItem.key}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            data-tree-list-row={row.kind}
            position="absolute"
            top="0"
            left="0"
            w="full"
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            {renderVirtualRow({
              row,
              expandedNodeIds,
              activeNodeId,
              focusRowId: keyboard.focusRowId,
              rowVariant,
              nodeGap,
              linkComponent,
              onRowFocus: keyboard.onRowFocus,
              onNavigate,
              onToggleSection,
              onToggleNode,
              onSectionContextMenu,
            })}
          </Box>
        );
      })}
    </Box>
  );
};

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
            {sectionRows.map((row) => (
              <Box key={row.key} w="full" minW="0">
                {renderVirtualRow({
                  row,
                  expandedNodeIds,
                  activeNodeId,
                  focusRowId: keyboard.focusRowId,
                  rowVariant,
                  nodeGap,
                  linkComponent,
                  onRowFocus: keyboard.onRowFocus,
                  onNavigate,
                  onToggleSection,
                  onToggleNode,
                  onSectionContextMenu,
                })}
              </Box>
            ))}
          </Stack>
        );
      })}
    </Stack>
  );
};

export const TreeList = (props: TreeListProps) => {
  if (props.draggable) {
    return (
      <TreeListSortable
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
      />
    );
  }

  return <StackTreeList {...props} />;
};
