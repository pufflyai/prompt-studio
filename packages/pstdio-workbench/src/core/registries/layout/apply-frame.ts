import type { Frame } from "./frame-types";
import type { SlotId, WorkbenchAreaState, WorkbenchLayout } from "./layout-types";

const createAreaState = (id: SlotId): WorkbenchAreaState => ({ id, widgets: [] });

export const applyFrameToLayout = (layout: WorkbenchLayout, frame: Frame): WorkbenchLayout => {
  const areas: Record<SlotId, WorkbenchAreaState> = {};
  const orphans: Record<SlotId, WorkbenchAreaState> = {};
  const candidates = { ...layout.orphans, ...layout.areas };

  for (const id of Object.keys(frame.slots)) {
    areas[id] = candidates[id] ?? createAreaState(id);
  }

  for (const [id, area] of Object.entries(candidates)) {
    if (!frame.slots[id]) orphans[id] = area;
  }

  const activeSlotId = layout.activeSlotId && areas[layout.activeSlotId] ? layout.activeSlotId : undefined;
  return {
    areas,
    nodes: layout.nodes,
    activeSlotId,
    activeResourceUri: activeSlotId ? layout.activeResourceUri : undefined,
    orphans: Object.keys(orphans).length > 0 ? orphans : undefined,
  };
};
