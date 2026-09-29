import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { Struct } from "./json";
import type { ParamObjectSchema } from "./params";

export interface ViewToolbarAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  presentation?: "primary" | "secondary";
  command: CommandRef<TParams, unknown>;
  params?: Record<string, unknown>;
  input?: ParamObjectSchema;
  submitLabel?: string;
  when?: string;
  disabled?: boolean;
}
