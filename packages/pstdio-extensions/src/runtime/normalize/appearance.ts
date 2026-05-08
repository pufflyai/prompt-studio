import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, normalize, resolve } from "node:path";
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

type VsCodeColorTheme = {
  colors?: Record<string, string>;
  tokenColors?: { scope?: string | string[]; settings?: { foreground?: string; fontStyle?: string } }[];
};

const themeTokenMap = {
  "editor.background": ["colors.bg", "colors.bg.code"],
  "editor.foreground": ["colors.fg"],
  "editorWidget.background": ["colors.bg.panel"],
  "sideBar.background": ["colors.bg.panel"],
  "panel.background": ["colors.bg.panel"],
  "input.background": ["colors.bg.subtle"],
  "input.foreground": ["colors.fg"],
  "input.border": ["colors.border"],
  "dropdown.background": ["colors.bg.panel"],
  "menu.background": ["colors.bg.panel", "colors.bg.menu-item.default"],
  "menu.foreground": ["colors.fg.menu-item.default"],
  "menu.selectionBackground": ["colors.bg.menu-item.selected"],
  "button.background": ["colors.bg.button.primary.default", "colors.bg.accent-primary.default"],
  "button.hoverBackground": ["colors.bg.button.primary.hover", "colors.bg.accent-primary.hover"],
  "button.foreground": ["colors.fg.button.primary.default"],
  focusBorder: ["colors.border.accent"],
  foreground: ["colors.fg"],
  descriptionForeground: ["colors.fg.muted"],
  disabledForeground: ["colors.fg.subtle"],
  border: ["colors.border"],
} satisfies Record<string, string[]>;

const stripJsonComments = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const stripTrailingCommas = (value: string) => value.replace(/,\s*([}\]])/g, "$1");

const parseJsonc = (path: string) =>
  JSON.parse(stripTrailingCommas(stripJsonComments(readFileSync(path, "utf8")))) as unknown;

const stripHash = (value: string) => value.replace(/^#/, "");

const createThemePreference = (id: string, mode: "light" | "dark", theme: VsCodeColorTheme): RuntimeThemePreference => {
  const tokens: Record<string, string> = {};
  const colors = theme.colors ?? {};

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
      code: `invalid_${codePrefix}_asset`,
      message: `${codePrefix === "theme" ? "Theme" : "File icon theme"} "${ext.namespace}.${localId}" must declare source via packageAsset()`,
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
        code: `missing_${codePrefix}_asset`,
        message: `${codePrefix === "theme" ? "Theme" : "File icon theme"} "${ext.namespace}.${localId}" asset is unavailable: ${error.message}`,
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
      message: `Theme "${ext.namespace}.${localId}" asset could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
    });
    return {};
  }
};

const isSafeRelativeAsset = (path: string) => {
  const normalized = normalize(path);
  return !path.includes("\0") && !isAbsolute(path) && normalized !== ".." && !normalized.startsWith(`..${"/"}`);
};

const validateIconFontAssets = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  localId: string,
  assetPath: string,
  iconTheme: Record<string, unknown>,
) => {
  const fonts = iconTheme.fonts;
  if (!Array.isArray(fonts)) return;

  for (const font of fonts) {
    if (!isRecord(font) || !Array.isArray(font.src)) continue;
    for (const src of font.src) {
      if (!isRecord(src) || typeof src.path !== "string") continue;
      if (!isSafeRelativeAsset(src.path) || !existsSync(resolve(dirname(assetPath), src.path))) {
        addAppearanceDiagnostic(runtime, {
          code: "invalid_file_icon_theme_font_asset",
          message: `File icon theme "${ext.namespace}.${localId}" font asset is unavailable: ${src.path}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        });
      }
    }
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
    if (isRecord(parsed)) {
      validateIconFontAssets(ext, source, runtime, localId, assetPath, parsed);
      return parsed;
    }
  } catch (error) {
    addAppearanceDiagnostic(runtime, {
      code: "malformed_file_icon_theme_asset",
      message: `File icon theme "${ext.namespace}.${localId}" asset could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
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
    if (!isRecord(contribution) || typeof contribution.title !== "string") {
      continue;
    }
    if (contribution.format !== "vscode-color-theme") {
      addAppearanceDiagnostic(runtime, {
        code: "unsupported_theme_format",
        message: `Theme "${ext.namespace}.${localId}" uses unsupported format "${String(contribution.format)}"`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      });
      continue;
    }

    const asset = validateContributionAsset(ext, source, runtime, localId, contribution.source, "theme");
    const parsedTheme = readThemeAsset(ext, source, runtime, localId, asset?.path ?? null);
    const id = `${ext.namespace}.${localId}`;
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
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      title: contribution.title,
      ...(typeof contribution.description === "string" ? { description: contribution.description } : {}),
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

const registerFileIconThemes = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.fileIconThemes ?? {})) {
    if (!isRecord(contribution) || typeof contribution.title !== "string") {
      continue;
    }
    if (contribution.format !== "vscode-file-icon-theme") {
      addAppearanceDiagnostic(runtime, {
        code: "unsupported_file_icon_theme_format",
        message: `File icon theme "${ext.namespace}.${localId}" uses unsupported format "${String(contribution.format)}"`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
      });
      continue;
    }

    const asset = validateContributionAsset(ext, source, runtime, localId, contribution.source, "file_icon_theme");
    const parsedTheme = readFileIconThemeAsset(ext, source, runtime, localId, asset?.path ?? null);
    const id = `${ext.namespace}.${localId}`;
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
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      title: contribution.title,
      ...(typeof contribution.description === "string" ? { description: contribution.description } : {}),
      format: contribution.format,
      source: contribution.source as RuntimeFileIconThemeRecord["source"],
      definitions: isRecord(parsedTheme.iconDefinitions) ? parsedTheme.iconDefinitions : {},
      fileExtensions: isRecord(parsedTheme.fileExtensions)
        ? (parsedTheme.fileExtensions as Record<string, string>)
        : {},
      fileNames: isRecord(parsedTheme.fileNames) ? (parsedTheme.fileNames as Record<string, string>) : {},
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
