import { Box, Stack, type StackProps } from "@chakra-ui/react";
import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDndContext,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { type MouseEvent as ReactMouseEvent, useContext } from "react";
import type { TreeListLinkComponent, TreeListNavigateEvent, TreeListNode, TreeListSection } from "./tree-list.types";
import { SharedTreeListDragContext } from "./tree-list-drag-provider";
import { type TreeListDropIndicator, treeListDropIndicator } from "./tree-list-drop-indicator";
import { buildVirtualRows, type VirtualRow } from "./tree-list-model";
import { TreeListNodeRow } from "./tree-list-node-row";
import {
  canDropOnTreeListTarget,
  computeReorderResult,
  type TreeListMovePolicy,
  toSectionDragId,
  verticalTreeDrag,
} from "./tree-list-reorder";
import { TreeListSectionHeader } from "./tree-list-section-header";
import { SortableHost } from "./tree-list-sortable-host";

type TreeListRowVariant = "compact" | "tree";

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
  indicator: TreeListDropIndicator | null;
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
    indicator,
  } = props;

  const headerRow = sectionRows.find((row) => row.kind === "section-header");
  const nodeRows = sectionRows.filter((row) => row.kind === "node");
  const topLevelNodeIds = nodeRows
    .filter((row) => row.kind === "node" && row.level === 0)
    .map((row) => (row.kind === "node" ? row.node.id : ""));

  return (
    <SortableHost
      id={toSectionDragId(section.id)}
      disabled={section.canReorder === false}
      indicator={indicator}
      handle="child"
    >
      {(listeners) => (
        <>
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
                    indicator={indicator}
                  />
                ) : null,
              )}
            </Stack>
          </SortableContext>
        </>
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
  indicator: TreeListDropIndicator | null;
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

// Top-level nodes participate in their section's SortableContext and can move
// between sections. Nested rows inherit position from their parent and render plain.
const SortableOrPlainNodeRow = (props: SortableOrPlainNodeRowProps) => {
  const { row, indicator, ...rest } = props;
  if (row.level > 0) {
    return renderNodeRow({ node: row.node, sectionId: row.sectionId, level: row.level, ...rest });
  }
  return (
    <SortableHost
      id={row.node.id}
      disabled={row.node.canReorder === false}
      indicator={indicator}
      handle="self"
      liftedBg="bg.hover"
    >
      {() => renderNodeRow({ node: row.node, sectionId: row.sectionId, level: row.level, ...rest })}
    </SortableHost>
  );
};

type SortableSectionsProps = Omit<
  TreeListSortableProps,
  "onReorderSections" | "onReorderNodes" | "canMove" | "expandedSectionIds" | "expandedNodeIds"
> & {
  expandedSectionIds: string[];
  expandedNodeIds: string[];
};

// Reads the drag state from the enclosing DndContext, which may be shared by several trees.
const SortableSections = (props: SortableSectionsProps) => {
  const { sections, expandedSectionIds, expandedNodeIds, sectionGap, ...rest } = props;
  const { active, over } = useDndContext();
  const indicator = active && over ? treeListDropIndicator(sections, String(active.id), String(over.id)) : null;
  const rows = buildVirtualRows(sections, expandedSectionIds, expandedNodeIds);
  return (
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
            rowVariant={rest.rowVariant ?? "tree"}
            nodeGap={rest.nodeGap}
            activeNodeId={rest.activeNodeId}
            linkComponent={rest.linkComponent}
            onNavigate={rest.onNavigate}
            onToggleSection={rest.onToggleSection}
            onToggleNode={rest.onToggleNode}
            onSectionContextMenu={rest.onSectionContextMenu}
            indicator={indicator}
          />
        ))}
      </Stack>
    </SortableContext>
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
  canMove?: TreeListMovePolicy;
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
    canMove,
  } = props;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const usesSharedDragContext = useContext(SharedTreeListDragContext);
  const collisionDetection: CollisionDetection = (input) =>
    closestCenter(input).filter((collision) =>
      canDropOnTreeListTarget(sections, String(input.active.id), String(collision.id), canMove),
    );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const result = computeReorderResult(sections, String(event.active.id), String(event.over.id), canMove);
    if (!result) return;
    if (result.kind === "section") {
      onReorderSections?.(result.nextSectionIds);
    } else {
      for (const [sectionId, nextNodeIds] of Object.entries(result.orders)) {
        onReorderNodes?.(sectionId, nextNodeIds);
      }
    }
  };

  const content = (
    <SortableSections
      sections={sections}
      expandedSectionIds={expandedSectionIds}
      expandedNodeIds={expandedNodeIds}
      activeNodeId={activeNodeId}
      rowVariant={rowVariant}
      sectionGap={sectionGap}
      nodeGap={nodeGap}
      linkComponent={linkComponent}
      onNavigate={onNavigate}
      onToggleSection={onToggleSection}
      onToggleNode={onToggleNode}
      onSectionContextMenu={onSectionContextMenu}
    />
  );
  if (usesSharedDragContext) return content;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={handleDragEnd}
      {...verticalTreeDrag}
    >
      {content}
    </DndContext>
  );
};
