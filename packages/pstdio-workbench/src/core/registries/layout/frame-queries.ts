import type { AnchorId, AnchorReadId, Frame, FrameSlot } from "./frame-types";

const listSlots = <TSlot extends string>(frame: Frame<TSlot>) =>
  Object.values(frame.slots as Readonly<Record<string, FrameSlot & { id: TSlot }>>);

export const getSurface = <TSlot extends string>(frame: Frame<TSlot>, area: TSlot) => frame.slots[area];

export const listAnchorAreas = <TSlot extends string>(frame: Frame<TSlot>) => {
  const areas: TSlot[] = [frame.primary];
  if (frame.secondary) areas.push(frame.secondary.slot);
  if (frame.attached) areas.push(frame.attached.slot);
  return areas;
};

export const listProjectionAreas = <TSlot extends string>(frame: Frame<TSlot>) =>
  listSlots(frame)
    .filter((slot) => slot.role === "projection")
    .map((slot) => slot.id);

export const listProjectionsReading = <TSlot extends string>(frame: Frame<TSlot>, anchorId: AnchorReadId) =>
  listSlots(frame)
    .filter((slot) => slot.role === "projection" && slot.reads?.includes(anchorId))
    .map((slot) => slot.id);

export const resolveAnchorArea = <TSlot extends string>(frame: Frame<TSlot>, anchorId: AnchorId) => {
  if (anchorId === "primary") return frame.primary;
  return frame[anchorId]?.slot;
};
