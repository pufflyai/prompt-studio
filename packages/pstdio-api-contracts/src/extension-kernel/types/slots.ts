import type { JsonObject, Struct } from "./json";

export type UiSlotKind = "menu" | "view" | "settings" | "renderer" | "kanbanRenderer" | "dataTableRenderer";

export interface SlotOptions<TKind extends UiSlotKind = UiSlotKind> {
  kind: TKind;
  label?: string;
  description?: string;
  metadata?: JsonObject;
}

export interface SlotRef<TContext extends Struct = Struct, TKind extends UiSlotKind = UiSlotKind> {
  id: string;
  kind: TKind;
  label?: string;
  description?: string;
  metadata?: JsonObject;
  /** Phantom field used to constrain compatible contributions; never populated at runtime. */
  context?: TContext;
}

export interface SlotInvocationContext<TContext extends Struct = Struct> {
  id: string;
  kind: UiSlotKind;
  context: TContext;
}
