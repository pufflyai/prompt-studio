import { MeasuringStrategy, type Modifier } from "@dnd-kit/core";
import type { TreeListSection } from "./tree-list.types";

const SECTION_PREFIX = "section:";

export const toSectionDragId = (sectionId: string) => `${SECTION_PREFIX}${sectionId}`;
export const isSectionDragId = (id: string) => id.startsWith(SECTION_PREFIX);
export const fromSectionDragId = (id: string) => id.slice(SECTION_PREFIX.length);

// The space after a section is its own drop zone: dropping there places an item behind the section.
const GAP_PREFIX = "after-section:";

export const toGapDragId = (sectionId: string) => `${GAP_PREFIX}${sectionId}`;
export const isGapDragId = (id: string) => id.startsWith(GAP_PREFIX);
export const fromGapDragId = (id: string) => id.slice(GAP_PREFIX.length);
const targetSectionId = (overId: string) => {
  if (isSectionDragId(overId)) return fromSectionDragId(overId);
  if (isGapDragId(overId)) return fromGapDragId(overId);
  return undefined;
};

export interface TreeListMoveEndpoint {
  kind: "section" | "node";
  sectionId: string;
  id: string;
  moveScope?: string;
}

export interface TreeListMove {
  source: TreeListMoveEndpoint;
  destination: TreeListMoveEndpoint;
}

export type TreeListMovePolicy = (move: TreeListMove) => boolean;

export const findNodeLocation = (sections: TreeListSection[], nodeId: string) => {
  for (const section of sections) {
    const index = section.nodes.findIndex((node) => node.id === nodeId);
    if (index >= 0) return { section, index, node: section.nodes[index]! };
  }
  return undefined;
};

const permitsMove = (move: TreeListMove, canMove: TreeListMovePolicy | undefined) => canMove?.(move) ?? true;

export const canDropOnTreeListTarget = (
  sections: TreeListSection[],
  activeId: string,
  overId: string,
  canMove?: TreeListMovePolicy,
) => {
  if (activeId === overId) return true;
  const overSectionId = targetSectionId(overId);
  if (isSectionDragId(activeId)) {
    if (overSectionId === undefined) return false;
    const source = sections.find((section) => section.id === fromSectionDragId(activeId));
    const destination = sections.find((section) => section.id === overSectionId);
    if (!source || !destination || source.canReorder === false || destination.canReorder === false) return false;
    return permitsMove(
      {
        source: { kind: "section", sectionId: source.id, id: source.id, moveScope: source.moveScope },
        destination: {
          kind: "section",
          sectionId: destination.id,
          id: destination.id,
          moveScope: destination.moveScope,
        },
      },
      canMove,
    );
  }

  const source = findNodeLocation(sections, activeId);
  if (!source || source.node.canReorder === false) return false;
  const destinationSection =
    overSectionId === undefined ? undefined : sections.find((section) => section.id === overSectionId);
  const destinationNode = overSectionId === undefined ? findNodeLocation(sections, overId) : undefined;
  const section = destinationSection ?? destinationNode?.section;
  if (!section || section.canReorder === false || destinationNode?.node.canReorder === false) return false;
  return permitsMove(
    {
      source: {
        kind: "node",
        sectionId: source.section.id,
        id: source.node.id,
        moveScope: source.node.moveScope ?? source.section.moveScope,
      },
      destination: destinationNode
        ? {
            kind: "node",
            sectionId: section.id,
            id: destinationNode.node.id,
            moveScope: destinationNode.node.moveScope ?? section.moveScope,
          }
        : { kind: "section", sectionId: section.id, id: section.id, moveScope: section.moveScope },
    },
    canMove,
  );
};

const lockToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

// Tree lists are vertical: sideways pointer movement neither picks drop targets nor scrolls containers.
// Drop zones for empty sections appear once a drag starts, so they are measured while dragging.
export const verticalTreeDrag = {
  modifiers: [lockToVerticalAxis],
  autoScroll: { threshold: { x: 0, y: 0.2 } },
  measuring: { droppable: { strategy: MeasuringStrategy.Always } },
};
