import { readFileSync } from "node:fs";
import type { JsonObject } from "@pstdio/sdk/extensions";
import { isPackageAssetDescriptor } from "../../artifacts/asset-validation";
import { PackageAssetError, resolvePackageAsset } from "../../artifacts/package-assets";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { findLocalizedStrings } from "./localizable";

const DEFAULT_LOCALE = "en";

const addTranslationDiagnostic = (
  runtime: Accumulator,
  input: { code: string; message: string; extensionId: string; sourcePath: string; metadata?: JsonObject },
) => runtime.diagnostics.push(createDiagnostic(input));

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;

const isFlatBundle = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");

const readTranslationBundle = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  locale: string,
  asset: unknown,
) => {
  if (!isPackageAssetDescriptor(asset)) {
    addTranslationDiagnostic(runtime, {
      code: "missing_translation_asset",
      message: `Translation bundle "${ext.name}.${locale}" must declare source via packageAsset()`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
      metadata: { locale },
    });
    return null;
  }

  try {
    const resolved = resolvePackageAsset(asset, { sourcePath: source.sourcePath });
    const parsed = readJson(resolved.path);
    if (isFlatBundle(parsed)) return parsed;
    throw new Error("bundle must be a flat JSON object with string values");
  } catch (error) {
    const isMissing = error instanceof PackageAssetError;
    addTranslationDiagnostic(runtime, {
      code: isMissing ? "missing_translation_asset" : "malformed_translation_bundle",
      message: `Translation bundle "${ext.name}.${locale}" could not be loaded: ${
        error instanceof Error ? error.message : String(error)
      }`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
      metadata: { locale },
    });
    return null;
  }
};

const collectInlineDefaults = (definition: unknown) => {
  const defaults: Record<string, string> = {};
  const keys = new Set<string>();

  for (const token of findLocalizedStrings(definition)) {
    keys.add(token.$l10n);
    if (token.default !== undefined && defaults[token.$l10n] === undefined) {
      defaults[token.$l10n] = token.default;
    }
  }

  return { defaults, keys };
};

export const registerTranslations = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const defaultLocale =
    typeof source.definition.defaultLocale === "string" ? source.definition.defaultLocale : DEFAULT_LOCALE;
  const declaredBundles = isRecord(source.definition.translations) ? source.definition.translations : {};
  const inline = collectInlineDefaults(source.definition);

  if (inline.keys.size === 0 && Object.keys(declaredBundles).length === 0) return;
  if (index.translationIds.has(ext.id)) return;

  const bundles: Record<string, Record<string, string>> = {
    [defaultLocale]: { ...inline.defaults },
  };

  for (const [locale, asset] of Object.entries(declaredBundles)) {
    const bundle = readTranslationBundle(ext, source, runtime, locale, asset);
    if (!bundle) continue;
    bundles[locale] = { ...(locale === defaultLocale ? inline.defaults : {}), ...bundle };
  }

  for (const key of inline.keys) {
    if (bundles[defaultLocale]?.[key] !== undefined) continue;
    addTranslationDiagnostic(runtime, {
      code: "missing_translation_key",
      message: `Translation key "${key}" has no inline default or "${defaultLocale}" bundle entry`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
      metadata: { key },
    });
  }

  const record = { extensionId: ext.id, defaultLocale, bundles };
  index.translationIds.set(ext.id, record);
  runtime.translations.push(record);
};
