import type { ExtensionDefinition, ExtensionSettingProperty } from "pstdio-api-contracts/extension-kernel";

type SettingValue<TProperty> = TProperty extends { type: "boolean" }
  ? boolean
  : TProperty extends { type: "number" }
    ? number
    : TProperty extends { type: "string" }
      ? string
      : TProperty extends { type: "array" }
        ? unknown[]
        : TProperty extends { type: "object" }
          ? Record<string, unknown>
          : unknown;

export type SettingsMap<TSettings> = TSettings extends {
  properties: infer TProperties extends Record<string, ExtensionSettingProperty>;
}
  ? { [K in keyof TProperties & string]: SettingValue<TProperties[K]> }
  : Record<string, never>;

/**
 * Type an extension's contribution arrays. Package identity stays in package.json.
 * Use the contribution helpers so every independently addressable item has a local
 * id and typed ref before it reaches this boundary.
 */
export const defineExtension = <const TDefinition extends ExtensionDefinition>(extension: TDefinition) => extension;
