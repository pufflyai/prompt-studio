import type { CommandDiagnostic } from "./commands";
import type { Struct } from "./json";

export interface EventRef<TPayload extends Struct = Struct> {
  readonly extensionId?: string;
  readonly kind: "event";
  readonly id: string;
  payload?: TPayload;
}

export interface EventDeliveryResult {
  delivered: number;
  diagnostics?: CommandDiagnostic[];
}
