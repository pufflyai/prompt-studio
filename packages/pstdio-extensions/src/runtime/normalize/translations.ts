import { readFileSync } from "node:fs";
import type { JsonObject } from "@pstdio/sdk/extensions";
import { isPackageAssetDescriptor } from "../../artifacts/asset-validation";
import { PackageAssetError, resolvePackageAsset } from "../../artifacts/package-assets";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import type { LocalizedExtensionSource as LoadedExtensionSource } from "./localizable";

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
    if (isFlatBundle(parsed)) return { bundle: parsed, sourcePath: resolved.path };
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

export const registerTranslations = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const defaultLocale =
    typeof source.definition.defaultLocale === "string" ? source.definition.defaultLocale : DEFAULT_LOCALE;
  const declaredBundles = isRecord(source.definition.translations) ? source.definition.translations : {};
  const inline = source.localization;
  for (const diagnostic of inline.diagnostics) {
    addTranslationDiagnostic(runtime, { ...diagnostic, extensionId: ext.id, sourcePath: source.sourcePath });
  }

  if (inline.keys.size === 0 && Object.keys(declaredBundles).length === 0) return;
  if (index.translationIds.has(ext.id)) return;

  const bundles: Record<string, Record<string, string>> = {
    [defaultLocale]: { ...inline.defaults },
  };

  for (const [locale, asset] of Object.entries(declaredBundles)) {
    const loaded = readTranslationBundle(ext, source, runtime, locale, asset);
    if (!loaded) continue;
    const { bundle, sourcePath } = loaded;
    for (const key of Object.keys(bundle)) {
      if (!key.startsWith("contributions/") || inline.automaticKeys.has(key)) continue;
      addTranslationDiagnostic(runtime, {
        code: "stale_automatic_translation_key",
        message: `Translation bundle "${sourcePath}" (${locale}) contains unknown automatic key "${key}"`,
        extensionId: ext.id,
        sourcePath,
        metadata: { locale, key },
      });
    }
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
