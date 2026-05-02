import type { Struct } from "./types/json";
import type { SlotOptions, SlotRef, UiSlotKind } from "./types/slots";

export const defineSlot = <TContext extends Struct = Struct, TKind extends UiSlotKind = UiSlotKind>(
  id: string,
  options: SlotOptions<TKind>,
): SlotRef<TContext, TKind> => ({
  id,
  kind: options.kind,
  label: options.label,
});
