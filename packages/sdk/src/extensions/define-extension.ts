import type { ExtensionDefinition, ExtensionSettingProperty } from "pstdio-api-contracts/extension-kernel";
import { collectionQueryIndex } from "./collection-view";

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

type NoExtraFields<Definition, Contract> = Definition & Record<Exclude<keyof Definition, keyof Contract>, never>;

/**
 * Type an extension's contribution arrays. Package identity stays in package.json.
 * Use the contribution helpers so every independently addressable item has a local
 * id and typed ref before it reaches this boundary.
 */
export const defineExtension = <const TDefinition extends ExtensionDefinition>(
  extension: NoExtraFields<TDefinition, ExtensionDefinition>,
) => {
  const installed = [...(extension.storageIndexes ?? [])];
  for (const view of extension.views ?? []) {
    const index = collectionQueryIndex("query" in view.body ? view.body.query : undefined);
    if (!index) continue;
    const existing = installed.find(({ name }) => name === index.name);
    if (existing && JSON.stringify(existing) !== JSON.stringify(index))
      throw new Error(`Different collection projections share index ${index.name}`);
    if (!existing) installed.push(index);
  }
  return (installed.length ? { ...extension, storageIndexes: installed } : extension) as TDefinition &
    Pick<ExtensionDefinition, "storageIndexes">;
};
