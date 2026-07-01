import { readFileSync } from "node:fs";
import { isPackageAssetDescriptor } from "../../artifacts/asset-validation";
import { PackageAssetError, resolvePackageAsset } from "../../artifacts/package-assets";
import type {
  NormalizedExtension,
  RuntimeFileIconThemeRecord,
  RuntimeMonacoTheme,
  RuntimeThemePreference,
  RuntimeThemeRecord,
} from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { collectIconFontAssets } from "./icon-fonts";
import { asLocalizableString, isLocalizableString } from "./localizable";

type VsCodeColorTheme = {
  colors?: Record<string, string>;
  tokenColors?: { scope?: string | string[]; settings?: { foreground?: string; fontStyle?: string } }[];
};

const themeTokenMap = {
  "editor.background": ["colors.bg", "colors.bg.code"],
  "editor.foreground": ["colors.fg"],
  "editor.lineHighlightBackground": ["colors.bg.hover"],
  "editor.selectionBackground": ["colors.bg.active"],
  "editorWidget.background": ["colors.bg.panel"],
  "sideBar.background": ["colors.bg.panel"],
  "panel.background": ["colors.bg.panel"],
  "input.background": ["colors.bg.subtle"],
  "input.foreground": ["colors.fg"],
  "input.border": ["colors.border"],
  "dropdown.background": ["colors.bg.panel"],
  "menu.background": ["colors.bg.panel", "colors.bg.menu-item.default"],
  "menu.foreground": ["colors.fg.menu-item.default"],
  "menu.selectionBackground": [
    "colors.bg.menu-item.hover",
    "colors.bg.menu-item.focus",
    "colors.bg.menu-item.selected",
  ],
  "list.hoverBackground": ["colors.bg.menu-item.hover", "colors.bg.menu-item.focus"],
  "list.focusBackground": ["colors.bg.menu-item.focus"],
  "list.inactiveSelectionBackground": ["colors.bg.menu-item.selected"],
  "list.activeSelectionBackground": ["colors.bg.menu-item.selected"],
  "badge.background": ["colors.bg.muted"],
  "badge.foreground": ["colors.fg.muted"],
  "button.background": ["colors.bg.button.primary.default", "colors.bg.accent-primary.default"],
  "button.hoverBackground": ["colors.bg.button.primary.hover", "colors.bg.accent-primary.hover"],
  "button.foreground": ["colors.fg.button.primary.default"],
  "diffEditor.insertedTextBackground": ["colors.bg.success"],
  "diffEditor.removedTextBackground": ["colors.bg.error"],
  focusBorder: ["colors.border.accent"],
  foreground: ["colors.fg"],
  "gitDecoration.addedResourceForeground": ["colors.fg.success"],
  "gitDecoration.deletedResourceForeground": ["colors.fg.error"],
  descriptionForeground: ["colors.fg.muted"],
  disabledForeground: ["colors.fg.subtle"],
  border: ["colors.border", "colors.border.subtle"],
} satisfies Record<string, string[]>;

const getVsCodeTokenPath = (token: string) => `colors.vscode.${token}`;

const stripJsonComments = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const stripTrailingCommas = (value: string) => value.replace(/,\s*([}\]])/g, "$1");

const parseJsonc = (path: string) =>
  JSON.parse(stripTrailingCommas(stripJsonComments(readFileSync(path, "utf8")))) as unknown;

const stripHash = (value: string) => value.replace(/^#/, "");

const createThemePreference = (id: string, mode: "light" | "dark", theme: VsCodeColorTheme): RuntimeThemePreference => {
  const tokens: Record<string, string> = {};
  const colors = theme.colors ?? {};

  for (const [vsCodeToken, value] of Object.entries(colors)) {
    tokens[getVsCodeTokenPath(vsCodeToken)] = value;
  }

  for (const [vsCodeToken, tokenPaths] of Object.entries(themeTokenMap)) {
    const value = colors[vsCodeToken];
    if (!value) continue;
    for (const tokenPath of tokenPaths) tokens[tokenPath] = value;
  }

  return { id, mode, tokens };
};

const createMonacoTheme = (mode: "light" | "dark", theme: VsCodeColorTheme): RuntimeMonacoTheme => ({
  base: mode === "dark" ? "vs-dark" : "vs",
  inherit: true,
  rules: (theme.tokenColors ?? []).flatMap((tokenColor) => {
    const scopes = Array.isArray(tokenColor.scope) ? tokenColor.scope : tokenColor.scope ? [tokenColor.scope] : [];
    return scopes.map((scope) => ({
      token: scope,
      ...(tokenColor.settings?.foreground ? { foreground: stripHash(tokenColor.settings.foreground) } : {}),
      ...(tokenColor.settings?.fontStyle ? { fontStyle: tokenColor.settings.fontStyle } : {}),
    }));
  }),
  colors: theme.colors ?? {},
});

const addAppearanceDiagnostic = (
  runtime: Accumulator,
  input: { code: string; message: string; extensionId: string; sourcePath: string },
) => runtime.diagnostics.push(createDiagnostic(input));

const validateContributionAsset = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  localId: string,
  asset: unknown,
  codePrefix: "theme" | "file_icon_theme",
) => {
  if (!isPackageAssetDescriptor(asset)) {
    addAppearanceDiagnostic(runtime, {
      code: `${codePrefix}_source_invalid`,
      message: `${codePrefix === "theme" ? "Theme" : "File icon theme"} "${ext.name}.${localId}" must declare source via packageAsset()`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
    });
    return null;
  }

  try {
    return resolvePackageAsset(asset, { sourcePath: source.sourcePath });
  } catch (error) {
    if (error instanceof PackageAssetError) {
      addAppearanceDiagnostic(runtime, {
        code: `${codePrefix}_source_invalid`,
        message: `${codePrefix === "theme" ? "Theme" : "File icon theme"} "${ext.name}.${localId}" asset is unavailable: ${error.message}`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      });
    }
    return null;
  }
};

const readThemeAsset = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  localId: string,
  assetPath: string | null,
): VsCodeColorTheme => {
  if (!assetPath) return {};
  try {
    const parsed = parseJsonc(assetPath);
    return isRecord(parsed) ? (parsed as VsCodeColorTheme) : {};
  } catch (error) {
    addAppearanceDiagnostic(runtime, {
      code: "malformed_theme_asset",
      message: `Theme "${ext.name}.${localId}" asset could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
    });
    return {};
  }
};

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

const inferMode = (theme: VsCodeColorTheme, fallback: unknown): "light" | "dark" => {
  if (fallback === "light" || fallback === "dark") return fallback;
  const background = theme.colors?.["editor.background"] ?? "";
  return background.toLowerCase() < "#808080" ? "dark" : "light";
};

const registerThemes = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.themes ?? {})) {
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
    const id = `${ext.name}.${localId}`;
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
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
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

const registerFileIconThemes = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.fileIconThemes ?? {})) {
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
    const id = `${ext.name}.${localId}`;
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
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
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

export const registerAppearance = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  registerThemes(ext, source, runtime, index);
  registerFileIconThemes(ext, source, runtime, index);
};
