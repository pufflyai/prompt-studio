import type { TreeListSection } from "./tree-list.types";

const SECTION_PREFIX = "section:";

export const toSectionDragId = (sectionId: string) => `${SECTION_PREFIX}${sectionId}`;
export const isSectionDragId = (id: string) => id.startsWith(SECTION_PREFIX);
export const fromSectionDragId = (id: string) => id.slice(SECTION_PREFIX.length);

const arrayMoveInPlace = <T>(items: T[], from: number, to: number) => {
  const next = items.slice();
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
};

export type ReorderResult =
  | { kind: "section"; nextSectionIds: string[] }
  | { kind: "node"; orders: Record<string, string[]> };

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

const findNodeLocation = (sections: TreeListSection[], nodeId: string) => {
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
  if (isSectionDragId(activeId)) {
    if (!isSectionDragId(overId)) return false;
    const source = sections.find((section) => section.id === fromSectionDragId(activeId));
    const destination = sections.find((section) => section.id === fromSectionDragId(overId));
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
  const destinationSection = isSectionDragId(overId)
    ? sections.find((section) => section.id === fromSectionDragId(overId))
    : undefined;
  const destinationNode = destinationSection ? undefined : findNodeLocation(sections, overId);
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

const computeSectionReorder = (
  sections: TreeListSection[],
  activeId: string,
  overId: string,
  canMove?: TreeListMovePolicy,
): ReorderResult | null => {
  const activeSection = sections.find((section) => section.id === fromSectionDragId(activeId));
  const overSection = sections.find((section) => section.id === fromSectionDragId(overId));
  if (!activeSection || !overSection) return null;
  if (activeSection.canReorder === false || overSection.canReorder === false) return null;
  if (
    !permitsMove(
      {
        source: {
          kind: "section",
          sectionId: activeSection.id,
          id: activeSection.id,
          moveScope: activeSection.moveScope,
        },
        destination: {
          kind: "section",
          sectionId: overSection.id,
          id: overSection.id,
          moveScope: overSection.moveScope,
        },
      },
      canMove,
    )
  ) {
    return null;
  }
  const orderedIds = sections.map((section) => section.id);
  const oldIndex = orderedIds.indexOf(activeSection.id);
  const newIndex = orderedIds.indexOf(overSection.id);
  if (oldIndex === newIndex) return null;
  return { kind: "section", nextSectionIds: arrayMoveInPlace(orderedIds, oldIndex, newIndex) };
};

const computeNodeReorder = (
  sections: TreeListSection[],
  activeId: string,
  overId: string,
  canMove?: TreeListMovePolicy,
): ReorderResult | null => {
  const source = findNodeLocation(sections, activeId);
  if (!source || source.node.canReorder === false) return null;
  const overSection = isSectionDragId(overId)
    ? sections.find((section) => section.id === fromSectionDragId(overId))
    : undefined;
  const overNode = overSection ? undefined : findNodeLocation(sections, overId);
  const destinationSection = overSection ?? overNode?.section;
  if (!destinationSection || destinationSection.canReorder === false || overNode?.node.canReorder === false)
    return null;

  const destination: TreeListMoveEndpoint = overNode
    ? {
        kind: "node",
        sectionId: destinationSection.id,
        id: overNode.node.id,
        moveScope: overNode.node.moveScope ?? destinationSection.moveScope,
      }
    : {
        kind: "section",
        sectionId: destinationSection.id,
        id: destinationSection.id,
        moveScope: destinationSection.moveScope,
      };
  if (
    !permitsMove(
      {
        source: {
          kind: "node",
          sectionId: source.section.id,
          id: source.node.id,
          moveScope: source.node.moveScope ?? source.section.moveScope,
        },
        destination,
      },
      canMove,
    )
  ) {
    return null;
  }

  const sourceIds = source.section.nodes.map((node) => node.id);
  if (source.section.id === destinationSection.id) {
    const newIndex = overNode ? overNode.index : sourceIds.length - 1;
    if (source.index === newIndex) return null;
    return { kind: "node", orders: { [source.section.id]: arrayMoveInPlace(sourceIds, source.index, newIndex) } };
  }

  const destinationIds = destinationSection.nodes.map((node) => node.id);
  const insertionIndex = overNode ? overNode.index : destinationIds.length;
  destinationIds.splice(insertionIndex, 0, source.node.id);
  return {
    kind: "node",
    orders: {
      [source.section.id]: sourceIds.filter((id) => id !== source.node.id),
      [destinationSection.id]: destinationIds,
    },
  };
};

export const computeReorderResult = (
  sections: TreeListSection[],
  activeId: string,
  overId: string,
  canMove?: TreeListMovePolicy,
): ReorderResult | null => {
  if (activeId === overId) return null;
  if (isSectionDragId(activeId)) {
    return isSectionDragId(overId) ? computeSectionReorder(sections, activeId, overId, canMove) : null;
  }
  return computeNodeReorder(sections, activeId, overId, canMove);
};
