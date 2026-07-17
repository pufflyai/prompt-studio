import type { FrameNode, FrameRegion, FrameSlot, SideBinding, SlotsOf } from "./frame-types";

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

const indexRegions = (slots: Record<string, FrameSlot>) => {
  const regions: Record<string, FrameRegion> = {};

  for (const slot of Object.values(slots)) {
    const header = slot.regions?.header;
    const leftMenu = slot.regions?.leftMenu;
    const rightMenu = slot.regions?.rightMenu;
    if (header) regions[header] = { kind: "region", id: header, host: slot.id, role: "header" };
    if (leftMenu) regions[leftMenu] = { kind: "region", id: leftMenu, host: slot.id, role: "menu", side: "left" };
    if (rightMenu) regions[rightMenu] = { kind: "region", id: rightMenu, host: slot.id, role: "menu", side: "right" };
  }

  return regions;
};

export const defineFrame = <const TRoot extends FrameNode, const TPrimary extends string>(input: {
  id: string;
  root: TRoot;
  primary: TPrimary & SlotsOf<TRoot>;
  secondary?: SideBinding<Exclude<SlotsOf<TRoot>, TPrimary>>;
  attached?: SideBinding<Exclude<SlotsOf<TRoot>, TPrimary>>;
}) => {
  const slots = indexSlots(input.root);
  return {
    ...input,
    slots: slots as Readonly<Record<SlotsOf<TRoot>, FrameSlot & { id: SlotsOf<TRoot> }>>,
    regions: indexRegions(slots),
  };
};
