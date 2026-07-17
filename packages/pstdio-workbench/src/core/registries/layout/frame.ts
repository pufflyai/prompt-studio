import type { FrameNode, FrameSlot, SideBinding, SlotsOf } from "./frame-types";

const indexSlots = (root: FrameNode) => {
  const slots: Record<string, FrameSlot> = {};

  const visit = (node: FrameNode) => {
    if (node.kind === "slot") {
      slots[node.id] = node;
      return;
    }

    for (const child of node.children) visit(child);
  };

  visit(root);
  return slots;
};

export const defineFrame = <const TRoot extends FrameNode, const TPrimary extends string>(input: {
  id: string;
  root: TRoot;
  primary: TPrimary & SlotsOf<TRoot>;
  secondary?: SideBinding<Exclude<SlotsOf<TRoot>, TPrimary>>;
  attached?: SideBinding<Exclude<SlotsOf<TRoot>, TPrimary>>;
}) => ({
  ...input,
  slots: indexSlots(input.root) as Readonly<Record<SlotsOf<TRoot>, FrameSlot & { id: SlotsOf<TRoot> }>>,
});
