import { isLocalizedString, type Localizable } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtensionSource } from "../loader";
import { isRecord } from "./accumulator";
import { type LocalizableFields, localizableContributionFields } from "./localizable-fields";

export const isLocalizableString = (value: unknown): value is Localizable<string> =>
  typeof value === "string" || isLocalizedString(value);

export const asLocalizableString = (value: unknown): Localizable<string> | undefined =>
  isLocalizableString(value) ? value : undefined;

export const automaticTranslationKey = (path: readonly string[]) =>
  `contributions/${path.map((part) => part.replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;

export const createLocalizationCollector = () => {
  const defaults: Record<string, string> = {};
  const keys = new Set<string>();
  const automaticKeys = new Set<string>();
  const diagnostics: { code: string; message: string; metadata: { key: string; declaration?: string } }[] = [];
  const value = (input: unknown, path?: readonly string[], declaration = path?.join("/")) => {
    if (!isLocalizableString(input)) return input;
    if (typeof input === "string" && !path) return input;
    const automatic = typeof input === "string";
    const token = automatic ? { $l10n: automaticTranslationKey(path!), default: input } : input;
    const key = token.$l10n;
    if (!automatic && key.startsWith("contributions/")) {
      diagnostics.push({
        code: "reserved_translation_key",
        message: `Explicit translation key "${key}" uses the reserved contributions/ namespace`,
        metadata: { key, declaration },
      });
    }
    if (automatic) {
      if (automaticKeys.has(key) && defaults[key] !== token.default) {
        diagnostics.push({
          code: "conflicting_automatic_translation_key",
          message: `Automatic translation key "${key}" has conflicting defaults`,
          metadata: { key },
        });
      }
      automaticKeys.add(key);
    }
    keys.add(key);
    if (token.default !== undefined && !Object.hasOwn(defaults, key)) defaults[key] = token.default;
    return token;
  };

  const normalizeItems = (input: unknown, schema: LocalizableFields, path: readonly string[], stable: boolean) => {
    if (!Array.isArray(input)) return input;
    const items: unknown[] = input.map((item) => {
      const keyed = Boolean(schema.keyed && isRecord(item) && typeof item.id === "string");
      const segment = keyed ? item.id : "[]";
      return normalize(item, (schema.keyed ?? schema.unkeyed)!, [...path, segment], stable && keyed);
    });
    return items;
  };
  const normalize = (input: unknown, schema: LocalizableFields, path: readonly string[], stable = true) => {
    if (schema.text) return value(input, stable ? path : undefined, path.join("/"));
    if (schema.keyed || schema.unkeyed) return normalizeItems(input, schema, path, stable);
    if (!isRecord(input)) return input;
    const variant = schema.variants?.[String(input.kind)];
    const fields = variant?.fields ?? schema.fields;
    const result: Record<string, unknown> = { ...input };
    for (const [key, child] of Object.entries(input)) {
      const childSchema = schema.record ?? fields?.[key];
      if (childSchema) result[key] = normalize(child, childSchema, [...path, key], stable);
    }
    return result;
  };

  const contributions = <T extends { id: string }>(
    collection: keyof typeof localizableContributionFields,
    items: readonly T[],
  ) => items.map((item) => normalize(item, localizableContributionFields[collection], [collection, item.id]) as T);
  const settings = (input: unknown) => normalize(input, localizableContributionFields.settings, ["settings"]);
  return { defaults, keys, automaticKeys, diagnostics, value, contributions, settings };
};

export type LocalizedExtensionSource = LoadedExtensionSource & {
  localization: ReturnType<typeof createLocalizationCollector>;
};
