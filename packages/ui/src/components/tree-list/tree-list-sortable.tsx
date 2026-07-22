import { Box, Stack, type StackProps } from "@chakra-ui/react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { TreeListLinkComponent, TreeListNavigateEvent, TreeListNode, TreeListSection } from "./tree-list.types";
import { buildVirtualRows, type VirtualRow } from "./tree-list-model";
import { TreeListNodeRow } from "./tree-list-node-row";
import { computeReorderResult, toSectionDragId } from "./tree-list-reorder";
import { TreeListSectionHeader } from "./tree-list-section-header";

type TreeListRowVariant = "compact" | "tree";

interface SortableHostProps {
  id: string;
  disabled?: boolean;
  children: (input: {
    setNodeRef: (element: HTMLElement | null) => void;
    listeners: ReturnType<typeof useSortable>["listeners"];
    style: { transform?: string; transition?: string; opacity?: number };
  }) => React.ReactNode;
}

// Render-prop sortable host. The child decides which DOM node receives the
// drag listeners so we never paint a visible grip glyph — the row or section
// header is itself the drag handle. Clicks pass through because the pointer
// sensor activates only after the cursor moves 4px (configured below).
const SortableHost = (props: SortableHostProps) => {
  const sortable = useSortable({ id: props.id, disabled: props.disabled });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.5 : 1,
  };
  return (
    <>
      {props.children({
        setNodeRef: sortable.setNodeRef,
        listeners: sortable.listeners,
        style,
      })}
    </>
  );
};

interface SortableSectionGroupProps {
  section: TreeListSection;
  sectionRows: VirtualRow[];
  expandedNodeIds: string[];
  activeNodeId?: string | string[] | null;
  rowVariant: TreeListRowVariant;
  nodeGap: StackProps["gap"];
  linkComponent?: TreeListLinkComponent;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleSection?: (sectionId: string) => void;
  onToggleNode?: (nodeId: string) => void;
  onSectionContextMenu?: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
}

const SortableSectionGroup = (props: SortableSectionGroupProps) => {
  const {
    section,
    sectionRows,
    expandedNodeIds,
    activeNodeId,
    rowVariant,
    nodeGap,
    linkComponent,
    onNavigate,
    onToggleSection,
    onToggleNode,
    onSectionContextMenu,
  } = props;

  const headerRow = sectionRows.find((row) => row.kind === "section-header");
  const nodeRows = sectionRows.filter((row) => row.kind === "node");
  const topLevelNodeIds = nodeRows
    .filter((row) => row.kind === "node" && row.level === 0)
    .map((row) => (row.kind === "node" ? row.node.id : ""));

  return (
    <SortableHost id={toSectionDragId(section.id)} disabled={section.canReorder === false}>
      {({ setNodeRef, listeners, style }) => (
        <Box ref={setNodeRef} style={style} w="full" minW="0">
          {headerRow && headerRow.kind === "section-header" ? (
            // Drag listeners live on the header so dragging the section moves
            // it, while click-to-collapse still works via the activation
            // distance on the pointer sensor.
            <Box onPointerDownCapture={(event) => listeners?.onPointerDown?.(event)}>
              <TreeListSectionHeader
                section={headerRow.section}
                collapsible={headerRow.collapsible}
                expanded={headerRow.expanded}
                focusId={headerRow.key}
                tabIndex={-1}
                onFocus={() => {}}
                onToggle={() => onToggleSection?.(headerRow.sectionId)}
                onContextMenu={onSectionContextMenu}
              />
            </Box>
          ) : null}
          <SortableContext items={topLevelNodeIds} strategy={verticalListSortingStrategy}>
            <Stack gap={nodeGap} w="full" minW="0">
              {nodeRows.map((row) =>
                row.kind === "node" ? (
                  <SortableOrPlainNodeRow
                    key={row.key}
                    row={row}
                    expandedNodeIds={expandedNodeIds}
                    activeNodeId={activeNodeId}
                    rowVariant={rowVariant}
                    nodeGap={nodeGap}
                    linkComponent={linkComponent}
                    onNavigate={onNavigate}
                    onToggleNode={onToggleNode}
                  />
                ) : null,
              )}
            </Stack>
          </SortableContext>
        </Box>
      )}
    </SortableHost>
  );
};

interface SortableOrPlainNodeRowProps {
  row: Extract<VirtualRow, { kind: "node" }>;
  expandedNodeIds: string[];
  activeNodeId?: string | string[] | null;
  rowVariant: TreeListRowVariant;
  nodeGap: StackProps["gap"];
  linkComponent?: TreeListLinkComponent;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleNode?: (nodeId: string) => void;
}

const renderNodeRow = (input: {
  node: TreeListNode;
  sectionId: string;
  level: number;
  expandedNodeIds: string[];
  activeNodeId?: string | string[] | null;
  rowVariant: TreeListRowVariant;
  nodeGap: StackProps["gap"];
  linkComponent?: TreeListLinkComponent;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleNode?: (nodeId: string) => void;
}) => (
  <TreeListNodeRow
    sectionId={input.sectionId}
    node={input.node}
    level={input.level}
    expandedNodeIds={input.expandedNodeIds}
    activeNodeId={input.activeNodeId}
    rowVariant={input.rowVariant}
    nodeGap={input.nodeGap}
    linkComponent={input.linkComponent}
    onNavigate={input.onNavigate}
    onToggleNode={input.onToggleNode}
  />
);

// Top-level nodes participate in their section's SortableContext; nested rows
// inherit position from their parent and render plain (cross-section moves are
// out of scope per the ADR).
const SortableOrPlainNodeRow = (props: SortableOrPlainNodeRowProps) => {
  const { row, ...rest } = props;
  if (row.level > 0) {
    return renderNodeRow({ node: row.node, sectionId: row.sectionId, level: row.level, ...rest });
  }
  return (
    <SortableHost id={row.node.id} disabled={row.node.canReorder === false}>
      {({ setNodeRef, listeners, style }) => (
        <Box
          ref={setNodeRef}
          style={style}
          w="full"
          minW="0"
          onPointerDownCapture={(event) => listeners?.onPointerDown?.(event)}
        >
          {renderNodeRow({ node: row.node, sectionId: row.sectionId, level: row.level, ...rest })}
        </Box>
      )}
    </SortableHost>
  );
};

interface TreeListSortableProps {
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
  onReorderSections?: (nextSectionIds: string[]) => void;
  onReorderNodes?: (sectionId: string, nextNodeIds: string[]) => void;
}

export const TreeListSortable = (props: TreeListSortableProps) => {
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
    onReorderSections,
    onReorderNodes,
  } = props;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const result = computeReorderResult(sections, String(event.active.id), String(event.over.id));
    if (!result) return;
    if (result.kind === "section") {
      onReorderSections?.(result.nextSectionIds);
    } else {
      onReorderNodes?.(result.sectionId, result.nextNodeIds);
    }
  };

  const rows = buildVirtualRows(sections, expandedSectionIds, expandedNodeIds);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext
        items={sections.map((section) => toSectionDragId(section.id))}
        strategy={verticalListSortingStrategy}
      >
        <Stack gap={sectionGap} w="full" minW="0" maxW="full">
          {sections.map((section) => (
            <SortableSectionGroup
              key={section.id}
              section={section}
              sectionRows={rows.filter((row) => row.sectionId === section.id)}
              expandedNodeIds={expandedNodeIds}
              activeNodeId={activeNodeId}
              rowVariant={rowVariant}
              nodeGap={nodeGap}
              linkComponent={linkComponent}
              onNavigate={onNavigate}
              onToggleSection={onToggleSection}
              onToggleNode={onToggleNode}
              onSectionContextMenu={onSectionContextMenu}
            />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
};
