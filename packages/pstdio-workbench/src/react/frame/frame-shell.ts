import type { Frame, FrameNode, FrameSlot, SlotPresentation, WorkbenchLayoutNode } from "../../core";

const resolvePresentation = (slot: FrameSlot, node: WorkbenchLayoutNode | undefined) => {
  const presentations = slot.presentations;
  if (!presentations || presentations.length === 0) return undefined;
  if (node?.presentation && presentations.includes(node.presentation)) return node.presentation;
  return presentations[0];
};

const resolveFlowNode = (
  node: FrameNode,
  presentations: Readonly<Record<string, SlotPresentation | undefined>>,
): FrameNode | undefined => {
  if (node.kind === "slot") {
    if (node.role === "transient" || presentations[node.id] === "floating" || presentations[node.id] === "hidden") {
      return undefined;
    }
    return node;
  }

  const children = node.children
    .map((child) => resolveFlowNode(child, presentations))
    .filter((child): child is FrameNode => Boolean(child));
  if (children.length === 0) return undefined;
  if (children.length === 1) return children[0];
  return { ...node, children };
};

export const resolveFrameShell = (frame: Frame, nodes: Readonly<Record<string, WorkbenchLayoutNode>>) => {
  const presentations: Record<string, SlotPresentation | undefined> = {};
  const floating: FrameSlot[] = [];
  const transient: FrameSlot[] = [];

  for (const slot of Object.values(frame.slots)) {
    const presentation = resolvePresentation(slot, nodes[slot.id]);
    presentations[slot.id] = presentation;
    if (slot.role === "transient") transient.push(slot);
    else if (presentation === "floating") floating.push(slot);
  }

  return {
    flow: resolveFlowNode(frame.root, presentations),
    floating,
    transient,
  };
};
