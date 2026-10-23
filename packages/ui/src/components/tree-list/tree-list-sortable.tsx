import { Box, Stack, type StackProps } from "@chakra-ui/react";
import { DndContext, PointerSensor, useDndContext, useDndMonitor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Fragment, type MouseEvent as ReactMouseEvent, type RefObject, useContext, useState } from "react";
import type { TreeListLinkComponent, TreeListNavigateEvent, TreeListSection } from "./tree-list.types";
import {
  createTreeListDropHandler,
  dragPointerY,
  dropTargetFor,
  treeListCollisionDetection,
} from "./tree-list-drag-handling";
import { SharedTreeListDragContext } from "./tree-list-drag-provider";
import { type TreeListDropIndicator, treeListDropIndicator } from "./tree-list-drop-indicator";
import { buildVirtualRows, type VirtualRow } from "./tree-list-model";
import { TreeListNodes } from "./tree-list-nodes";
import { type TreeListMovePolicy, toSectionDragId, verticalTreeDrag } from "./tree-list-reorder";
import { TreeListReveal } from "./tree-list-reveal";
import { TreeListSectionHeader } from "./tree-list-section-header";
import { TreeListSelectionContext } from "./tree-list-selection-context";
import { canStartTreeListDrag, SectionGap, SortableHost } from "./tree-list-sortable-host";
import { VirtualTreeList } from "./tree-list-virtual";
import { useTreeListKeyboardNavigation } from "./use-tree-list-keyboard-navigation";

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
  onMoveNode?: (sourceNodeId: string, targetNodeId?: string, position?: "before" | "after" | "inside") => void;
  onSectionContextMenu?: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
  indicator: TreeListDropIndicator | null;
  dragging: boolean;
  focusRowId?: string;
  onRowFocus: (id: string) => void;
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
    onMoveNode,
    onSectionContextMenu,
    indicator,
    dragging,
    focusRowId,
    onRowFocus,
  } = props;

  const headerRow = sectionRows.find((row) => row.kind === "section-header");
  const nodeRows = sectionRows.filter((row) => row.kind === "node");
  const topLevelNodeIds = section.nodes.map((node) => node.id);

  return (
    <SortableHost
      id={toSectionDragId(section.id)}
      disabled={section.canReorder === false}
      indicator={indicator}
      handle="child"
      highlighted={indicator?.groupId === section.id}
    >
      {(listeners) => (
        <>
          {headerRow && headerRow.kind === "section-header" ? (
            // Drag listeners live on the header so dragging the section moves
            // it, while click-to-collapse still works via the activation
            // distance on the pointer sensor.
            <Box
              onPointerDownCapture={(event) => {
                if (canStartTreeListDrag(event.target)) listeners?.onPointerDown?.(event);
              }}
            >
              <TreeListSectionHeader
                section={headerRow.section}
                collapsible={headerRow.collapsible}
                expanded={headerRow.expanded}
                focusId={headerRow.key}
                tabIndex={headerRow.key === focusRowId ? 0 : -1}
                onFocus={() => onRowFocus(headerRow.key)}
                onToggle={() => onToggleSection?.(headerRow.sectionId)}
                onContextMenu={onSectionContextMenu}
              />
            </Box>
          ) : null}
          {/* An empty bare section is invisible until a drag starts; then it offers a row-sized drop zone. */}
          {dragging && !headerRow && nodeRows.length === 0 ? (
            <Box h="tree-empty-drop-zone" data-tree-list-empty-drop-zone="" />
          ) : null}
          <TreeListReveal open={!headerRow || (headerRow.kind === "section-header" && headerRow.expanded)}>
            <SortableContext items={topLevelNodeIds} strategy={verticalListSortingStrategy}>
              <TreeListNodes
                sectionId={section.id}
                nodes={section.nodes}
                expandedNodeIds={expandedNodeIds}
                activeNodeId={activeNodeId}
                rowVariant={rowVariant}
                nodeGap={nodeGap}
                linkComponent={linkComponent}
                onNavigate={onNavigate}
                onToggleNode={onToggleNode}
                onMoveNode={onMoveNode}
                sortable
                indicator={indicator}
                focusRowId={focusRowId}
                onRowFocus={onRowFocus}
              />
              {section.nodes.length === 0 ? section.emptyState : null}
            </SortableContext>
          </TreeListReveal>
        </>
      )}
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
  const selection = useContext(TreeListSelectionContext);
  const { sections, expandedSectionIds, expandedNodeIds, sectionGap, ...rest } = props;
  const { active, over } = useDndContext();
  const [pointerY, setPointerY] = useState<number | null>(null);
  useDndMonitor({
    onDragMove: (event) => setPointerY(dragPointerY(event.activatorEvent, event.delta.y)),
    onDragEnd: () => setPointerY(null),
    onDragCancel: () => setPointerY(null),
  });
  const target = active && pointerY !== null ? dropTargetFor(String(active.id), over, pointerY) : null;
  const indicator = treeListDropIndicator(sections, target, expandedNodeIds);
  const rows = buildVirtualRows(sections, expandedSectionIds, expandedNodeIds);
  const keyboard = useTreeListKeyboardNavigation({
    rows,
    activeNodeId: rest.activeNodeId,
    expandedNodeIds,
    onToggleNode: rest.onToggleNode,
    onToggleSection: rest.onToggleSection,
  });
  if (props.virtualize && props.scrollRef)
    return <VirtualTreeList {...props} rows={rows} scrollRef={props.scrollRef} sortable indicator={indicator} />;
  return (
    <SortableContext
      items={sections.map((section) => toSectionDragId(section.id))}
      strategy={verticalListSortingStrategy}
    >
      <Stack
        ref={keyboard.rootRef}
        role="listbox"
        aria-multiselectable={Boolean(selection) || undefined}
        onKeyDown={keyboard.handleKeyDown}
        gap="0"
        w="full"
        minW="0"
        maxW="full"
        position="relative"
      >
        {sections.map((section, index) => (
          <Fragment key={section.id}>
            <SortableSectionGroup
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
              onMoveNode={rest.onMoveNode}
              onSectionContextMenu={rest.onSectionContextMenu}
              indicator={indicator}
              dragging={Boolean(active)}
              focusRowId={keyboard.focusRowId}
              onRowFocus={keyboard.onRowFocus}
            />
            <SectionGap
              sectionId={section.id}
              nextSectionId={sections[index + 1]?.id}
              gap={sectionGap}
              indicator={indicator}
            />
          </Fragment>
        ))}
      </Stack>
    </SortableContext>
  );
};

interface TreeListSortableProps {
  virtualize?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
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
  onMoveNode?: (sourceNodeId: string, targetNodeId?: string, position?: "before" | "after" | "inside") => void;
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
    onMoveNode,
    onSectionContextMenu,
    onReorderSections,
    onReorderNodes,
    canMove,
  } = props;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const usesSharedDragContext = useContext(SharedTreeListDragContext);
  const collisionDetection = treeListCollisionDetection(sections, canMove);
  const handleDragEnd = createTreeListDropHandler({
    sections,
    canMove,
    onReorderSections: (nextSectionIds) => onReorderSections?.(nextSectionIds),
    onReorderNodes,
  });

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
      onMoveNode={onMoveNode}
      onSectionContextMenu={onSectionContextMenu}
      virtualize={props.virtualize}
      scrollRef={props.scrollRef}
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
