import type { FrameSlot, WorkbenchAreaSize } from "../../core";

export const isFixedSlotSize = (size: WorkbenchAreaSize) => size.minPx !== undefined && size.minPx === size.maxPx;

export const resolveSlotSize = (slot: FrameSlot, contributionSize: WorkbenchAreaSize | undefined) => {
  const defaultPx = contributionSize?.defaultPx ?? slot.size?.defaultPx;
  const minPx = contributionSize?.minPx ?? slot.size?.minPx;
  const maxPx = contributionSize?.maxPx ?? slot.size?.maxPx;

  return {
    ...(defaultPx === undefined ? {} : { defaultPx }),
    ...(minPx === undefined ? {} : { minPx }),
    ...(maxPx === undefined ? {} : { maxPx }),
  };
};
