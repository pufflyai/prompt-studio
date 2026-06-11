import type { Struct } from "./types/json";
import type { SlotOptions, SlotRef, UiSlotKind } from "./types/slots";

/**
 * Define a host-owned UI slot that extension contributions can target.
 */
export const defineSlot = <TContext extends Struct = Struct, TKind extends UiSlotKind = UiSlotKind>(
  id: string,
  options: SlotOptions<TKind>,
): SlotRef<TContext, TKind> => ({
  id,
  kind: options.kind,
  label: options.label,
  description: options.description,
  metadata: options.metadata,
});
