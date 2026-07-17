import type { Frame, FrameNode, FrameSlot, SlotPresentation } from "./frame-types";

const validPresentations = new Set<SlotPresentation>(["docked", "floating", "hidden"]);

export const validateFrame = (frame: Frame) => {
  const errors: string[] = [];
  const slotIds = new Set<string>();
  const regionIds = new Set<string>();
  const slots: FrameSlot[] = [];

  const visit = (node: FrameNode) => {
    if (node.kind === "split") {
      if (node.children.length === 0) errors.push(`empty split: ${node.id}`);
      for (const child of node.children) visit(child);
      return;
    }

    if (slotIds.has(node.id)) errors.push(`duplicate slot: ${node.id}`);
    slotIds.add(node.id);
    slots.push(node);
    for (const regionId of Object.values(node.regions ?? {})) {
      if (regionIds.has(regionId)) errors.push(`duplicate region: ${regionId}`);
      regionIds.add(regionId);
    }
  };

  visit(frame.root);

  if (!slotIds.has(frame.primary)) errors.push(`primary slot is not declared: ${frame.primary}`);
  if (frame.secondary && frame.attached && frame.secondary.slot === frame.attached.slot) {
    errors.push(`secondary and attached share slot: ${frame.secondary.slot}`);
  }

  for (const slot of slots) {
    const presentations = slot.presentations;
    if (presentations) {
      const unique = new Set(presentations);
      const containsUnknown = presentations.some((presentation) => !validPresentations.has(presentation));
      const hiddenOnly = presentations.length === 1 && presentations[0] === "hidden";
      if (presentations.length === 0 || unique.size !== presentations.length || containsUnknown || hiddenOnly) {
        errors.push(`invalid presentations for slot: ${slot.id}`);
      }
    }

    if (slot.companionOf && (slot.companionOf === slot.id || !slotIds.has(slot.companionOf))) {
      errors.push(`invalid companion for slot: ${slot.id}`);
    }
  }

  return errors;
};
