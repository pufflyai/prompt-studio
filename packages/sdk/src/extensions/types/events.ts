import type { CommandDiagnostic } from "./commands";
import type { JsonObject, Struct } from "./json";

export interface EventRef<TPayload extends Struct = Struct> {
  id: string;
  payload?: TPayload;
}

export interface EventReject {
  type: "reject";
  code?: string;
  reason: string;
  data?: JsonObject;
}

export type EventHandlerResult = EventReject | undefined;

export interface EventDeliveryResult {
  delivered: number;
  diagnostics?: CommandDiagnostic[];
  /** When set, an event hook short-circuited the dispatch by returning a reject. */
  rejection?: { extensionId: string; hookId: string; code?: string; reason: string; data?: JsonObject };
}
