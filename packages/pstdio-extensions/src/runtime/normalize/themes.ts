import type { ThemeContribution } from "@pstdio/sdk/extensions";
import { parseVsCodeColorTheme } from "pstdio-theme";
import type { NormalizedExtension, RuntimeThemeRecord } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { addAppearanceDiagnostic, parseJsonc, validateContributionAsset } from "./appearance-assets";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { asLocalizableString, isLocalizableString } from "./localizable";
import { createMonacoTheme, createThemePreference, inferMode } from "./vscode-color-theme";

const readThemeAsset = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  localId: string,
  assetPath: string | null,
) => {
  if (!assetPath) return null;
  try {
    const parsed = parseJsonc(assetPath);
    return parseVsCodeColorTheme(parsed);
  } catch (error) {
    addAppearanceDiagnostic(runtime, {
      code: "malformed_theme_asset",
      message: `Theme "${ext.name}.${localId}" asset could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
    });
    return null;
  }
};

export const registerThemes = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "theme",
    contributions: contributionArray<ThemeContribution>(source.definition.themes),
  });
  for (const contribution of contributions) {
    const localId = contribution.id;
    if (!isRecord(contribution) || !isLocalizableString(contribution.title)) {
      continue;
    }
    if (contribution.format !== "vscode-color-theme") {
      addAppearanceDiagnostic(runtime, {
        code: "unsupported_theme_format",
        message: `Theme "${ext.name}.${localId}" uses unsupported format "${String(contribution.format)}"`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      });
      continue;
    }

    const asset = validateContributionAsset(ext, source, runtime, localId, contribution.source, "theme");
    if (!asset) continue;
    const parsedTheme = readThemeAsset(ext, source, runtime, localId, asset.path);
    if (!parsedTheme) continue;
    const base = contributionRecordBase(ext, source, "theme", localId);
    const id = base.id;
    const mode = inferMode(parsedTheme, contribution.mode);
    if (index.themeIds.has(id)) {
      addAppearanceDiagnostic(runtime, {
        code: "duplicate_theme_id",
        message: `Theme "${id}" is declared by more than one enabled extension`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      });
      continue;
    }

    const record: RuntimeThemeRecord = {
      ...base,
      title: contribution.title,
      ...(asLocalizableString(contribution.description)
        ? { description: asLocalizableString(contribution.description) }
        : {}),
      format: contribution.format,
      mode,
      source: contribution.source as RuntimeThemeRecord["source"],
      preference: createThemePreference(id, mode, parsedTheme),
      monacoTheme: createMonacoTheme(mode, parsedTheme),
    };
    index.themeIds.set(id, record);
    runtime.themes.push(record);
  }
};
