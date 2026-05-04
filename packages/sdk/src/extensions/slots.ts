import type { Struct } from "./types/json";
import type { SlotOptions, SlotRef, UiSlotKind } from "./types/slots";

/**
 * Define a UI slot that contributions can target. The `TContext` parameter constrains
 * the data passed to renderers/menus invoked through the slot, and `TKind` picks the
 * contribution shape (`menu`, `navigation`, `view`, `settings`, `renderer`).
 *
 * @example
 *   export const projectHeader = defineSlot<{ projectId: string }, "menu">("project.header", {
 *     kind: "menu",
 *     label: "Project header",
 *   });
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
