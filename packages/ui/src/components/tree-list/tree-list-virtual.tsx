import { Box } from "@chakra-ui/react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode, RefObject } from "react";
import { useVirtualizer } from "@/utils/use-virtualizer";
import type { TreeListProps } from "./tree-list";
import type { TreeListDropIndicator } from "./tree-list-drop-indicator";
import type { VirtualRow } from "./tree-list-model";
import { toSectionDragId } from "./tree-list-reorder";
import { TreeListRow } from "./tree-list-row";
import { DropLine, SectionGap, SortableHost } from "./tree-list-sortable-host";
import { useTreeListKeyboardNavigation } from "./use-tree-list-keyboard-navigation";

const VIRTUAL_ROW_ESTIMATE = 32;
const VIRTUAL_ROW_OVERSCAN = 4;

interface VirtualTreeListProps extends TreeListProps {
  rows: VirtualRow[];
  scrollRef: RefObject<HTMLDivElement | null>;
  sortable?: boolean;
  indicator?: TreeListDropIndicator | null;
}

const VirtualRowContent = (props: {
  sortable: boolean;
  row: VirtualRow;
  indicator: TreeListDropIndicator | null;
  children: ReactNode;
}) => {
  const { sortable, row, indicator, children } = props;
  if (!sortable || row.kind === "section-empty") return children;
  if (row.kind === "node" && row.level > 0)
    return (
      <Box position="relative" minW="0">
        {children}
        {indicator?.lineId === row.node.id ? <DropLine edge={indicator.edge} /> : null}
      </Box>
    );
  const id = row.kind === "node" ? row.node.id : toSectionDragId(row.sectionId);
  const disabled = row.kind === "node" ? row.node.canReorder === false : row.section.canReorder === false;
  return (
    <SortableHost
      id={id}
      disabled={disabled}
      indicator={indicator}
      handle="self"
      liftedBg="bg.hover"
      highlighted={row.kind === "section-header" && indicator?.groupId === row.sectionId}
    >
      {() => children}
    </SortableHost>
  );
};

export const VirtualTreeList = (props: VirtualTreeListProps) => {
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
    onMoveNode,
    scrollRef,
    sortable = false,
    indicator = null,
    sectionGap = "0",
  } = props;

  const { virtualizer, virtualItems, totalSize } = useVirtualizer({
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

  const content = (
    <Box
      ref={keyboard.rootRef}
      data-tree-list-virtual=""
      role="listbox"
      w="full"
      minW="0"
      maxW="full"
      position="relative"
      style={{ height: totalSize }}
      onKeyDown={keyboard.handleKeyDown}
    >
      {virtualItems.map((virtualItem) => {
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
            pb={
              virtualItem.index === rows.length - 1 ||
              (sortable && row.sectionId !== rows[virtualItem.index + 1]?.sectionId)
                ? "0"
                : nodeGap
            }
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            <VirtualRowContent sortable={sortable} row={row} indicator={indicator}>
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
            </VirtualRowContent>
            {sortable && row.sectionId !== rows[virtualItem.index + 1]?.sectionId ? (
              <SectionGap
                sectionId={row.sectionId}
                nextSectionId={rows[virtualItem.index + 1]?.sectionId}
                gap={sectionGap}
                indicator={indicator}
              />
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
  return sortable ? (
    <SortableContext
      items={rows.flatMap((row) => {
        if (row.kind === "section-header") return [toSectionDragId(row.sectionId)];
        if (row.kind === "node" && row.level === 0) return [row.node.id];
        return [];
      })}
      strategy={verticalListSortingStrategy}
    >
      {content}
    </SortableContext>
  ) : (
    content
  );
};
