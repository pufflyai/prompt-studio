import type { FileIconThemeContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimeFileIconThemeRecord } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { addAppearanceDiagnostic, parseJsonc, validateContributionAsset } from "./appearance-assets";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { collectIconFontAssets } from "./icon-fonts";
import { asLocalizableString, isLocalizableString } from "./localizable";

const readFileIconThemeAsset = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  localId: string,
  assetPath: string | null,
) => {
  if (!assetPath) return {};
  try {
    const parsed = parseJsonc(assetPath);
    if (isRecord(parsed)) return parsed;
  } catch (error) {
    addAppearanceDiagnostic(runtime, {
      code: "malformed_file_icon_theme_asset",
      message: `File icon theme "${ext.name}.${localId}" asset could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
    });
  }
  return {};
};

const resolveFileIconThemeFonts = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  id: string,
  assetPath: string | null,
  parsedTheme: Record<string, unknown>,
) => {
  if (!assetPath) return [];
  const { fonts, invalidPaths } = collectIconFontAssets(assetPath, parsedTheme, id);
  for (const invalidPath of invalidPaths) {
    addAppearanceDiagnostic(runtime, {
      code: "invalid_file_icon_theme_font_asset",
      message: `File icon theme "${id}" font asset is unavailable: ${invalidPath}`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
    });
  }
  return fonts;
};

const asStringRecord = (value: unknown) => (isRecord(value) ? (value as Record<string, string>) : {});

const toFileIconThemeData = (parsedTheme: Record<string, unknown>) => ({
  definitions: isRecord(parsedTheme.iconDefinitions) ? parsedTheme.iconDefinitions : {},
  fileExtensions: asStringRecord(parsedTheme.fileExtensions),
  fileNames: asStringRecord(parsedTheme.fileNames),
  defaults: {
    ...(typeof parsedTheme.file === "string" ? { file: parsedTheme.file } : {}),
    ...(typeof parsedTheme.folder === "string" ? { folder: parsedTheme.folder } : {}),
  },
});

export const registerFileIconThemes = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "file-icon-theme",
    contributions: contributionArray<FileIconThemeContribution>(source.definition.fileIconThemes),
  });
  for (const contribution of contributions) {
    const localId = contribution.id;
    if (!isRecord(contribution) || !isLocalizableString(contribution.title)) {
      continue;
    }
    if (contribution.format !== "vscode-file-icon-theme") {
      addAppearanceDiagnostic(runtime, {
        code: "unsupported_file_icon_theme_format",
        message: `File icon theme "${ext.name}.${localId}" uses unsupported format "${String(contribution.format)}"`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      });
      continue;
    }

    const asset = validateContributionAsset(ext, source, runtime, localId, contribution.source, "file_icon_theme");
    if (!asset) continue;
    const parsedTheme = readFileIconThemeAsset(ext, source, runtime, localId, asset.path);
    const base = contributionRecordBase(ext, source, "file-icon-theme", localId);
    const id = base.id;
    const fonts = resolveFileIconThemeFonts(ext, source, runtime, id, asset?.path ?? null, parsedTheme);
    if (index.fileIconThemeIds.has(id)) {
      addAppearanceDiagnostic(runtime, {
        code: "duplicate_file_icon_theme_id",
        message: `File icon theme "${id}" is declared by more than one enabled extension`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      });
      continue;
    }

    const record: RuntimeFileIconThemeRecord = {
      ...base,
      title: contribution.title,
      ...(asLocalizableString(contribution.description)
        ? { description: asLocalizableString(contribution.description) }
        : {}),
      format: contribution.format,
      source: contribution.source as RuntimeFileIconThemeRecord["source"],
      ...toFileIconThemeData(parsedTheme),
      fonts,
    };
    index.fileIconThemeIds.set(id, record);
    runtime.fileIconThemes.push(record);
  }
};
