import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionRouteRecord, ExtensionsCheckResponse } from "pstdio-api-contracts";
import { validateWebviewCapabilityNames } from "pstdio-extensions/bridge/contract";
import {
  addDiagnostic,
  commandIdFromRef,
  eventIdFromRef,
  isRecord,
  slotId,
  validateArtifactPath,
  validatePackageAsset,
  validateWebviewEntry,
} from "./extension-diagnostics";
import type { LoadedExtension } from "./extension-runtime";

const cliPathForCommand = (namespace: string, key: string, cli: unknown) => {
  if (cli === false) return undefined;
  if (isRecord(cli) && Array.isArray(cli.path) && cli.path.every((part) => typeof part === "string")) {
    return [namespace, ...cli.path].join(" ");
  }
  return [namespace, ...key.split(".")].join(" ");
};

export const collectCommands = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const commands = loaded.definition.commands;
  if (!isRecord(commands)) return;

  for (const [key, command] of Object.entries(commands)) {
    const id = `${loaded.metadata.name}.${key}`;
    if (!isRecord(command)) {
      addDiagnostic(check, {
        code: "command_invalid",
        commandId: id,
        extensionId: loaded.metadata.id,
        message: `Command ${id} must be an object`,
        severity: "error",
        sourcePath,
      });
      continue;
    }

    collectCommand(check, loaded, sourcePath, key, command);
  }
};

const collectCommand = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  key: string,
  command: Record<string, unknown>,
) => {
  const id = `${loaded.metadata.name}.${key}`;
  if (typeof command.title !== "string" || typeof command.run !== "function") {
    addDiagnostic(check, {
      code: "command_metadata_invalid",
      commandId: id,
      extensionId: loaded.metadata.id,
      message: `Command ${id} must include title and run handler`,
      severity: "error",
      sourcePath,
    });
  }

  check.commands.push({
    id,
    cliPath: cliPathForCommand(loaded.metadata.name, key, command.cli),
    description: typeof command.description === "string" ? command.description : undefined,
    extensionId: loaded.metadata.id,
    title: typeof command.title === "string" ? command.title : key,
  });

  collectCommandMenus(check, loaded, key, command);
};

const collectCommandMenus = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  key: string,
  command: Record<string, unknown>,
) => {
  if (!Array.isArray(command.menus)) return;

  const commandId = `${loaded.metadata.name}.${key}`;
  command.menus.forEach((menu, index) => {
    if (!isRecord(menu)) return;
    check.menuContributions.push({
      id: `${commandId}.menu.${index}`,
      commandId: commandIdFromRef(menu.command) ?? commandId,
      extensionId: loaded.metadata.id,
      label: typeof menu.label === "string" ? menu.label : String(command.title ?? key),
      slotId: slotId(menu.slot),
    });
  });
};

export const collectMiddlewareHooksAndSchedules = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
) => {
  collectMiddlewares(check, loaded, sourcePath);
  collectHooks(check, loaded);
  collectSchedules(check, loaded);
};

const collectMiddlewares = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const middlewares = loaded.definition.middlewares;
  if (!isRecord(middlewares)) return;

  for (const [key, middleware] of Object.entries(middlewares)) {
    if (!isRecord(middleware)) continue;
    const commandId = commandIdFromRef(middleware.command) ?? commandIdFromRef(middleware.commandId);
    if (!commandId) {
      addDiagnostic(check, {
        code: "middleware_command_missing",
        extensionId: loaded.metadata.id,
        message: `Middleware ${key} must target a command`,
        severity: "error",
        sourcePath,
      });
      continue;
    }

    check.middlewares.push({
      id: `${loaded.metadata.name}.${key}`,
      commandId,
      extensionId: loaded.metadata.id,
    });
  }
};

const collectHooks = (check: ExtensionsCheckResponse, loaded: LoadedExtension) => {
  const hooks = loaded.definition.hooks;
  if (!isRecord(hooks)) return;

  for (const [key, hook] of Object.entries(hooks)) {
    if (!isRecord(hook)) continue;
    const eventId = eventIdFromRef(hook.event) ?? eventIdFromRef(hook.eventId);
    if (eventId) {
      check.hooks.push({ id: `${loaded.metadata.name}.${key}`, eventId, extensionId: loaded.metadata.id });
    }
  }
};

const collectSchedules = (check: ExtensionsCheckResponse, loaded: LoadedExtension) => {
  const schedules = loaded.definition.schedules;
  if (!isRecord(schedules)) return;

  for (const [key, schedule] of Object.entries(schedules)) {
    if (!isRecord(schedule)) continue;
    const commandId = commandIdFromRef(schedule.command) ?? commandIdFromRef(schedule.commandId);
    if (typeof schedule.cron === "string" && commandId) {
      check.schedules.push({
        id: `${loaded.metadata.name}.${key}`,
        commandId,
        cron: schedule.cron,
        extensionId: loaded.metadata.id,
      });
    }
  }
};

export const collectAssetsAndUi = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  collectArtifactMounts(check, loaded, sourcePath);
  validateWebviewContributionEntries(check, loaded, sourcePath);
  collectRoutes(check, loaded);
  collectNavigation(check, loaded);
  collectPackageAssetRecords(check, loaded, sourcePath, "templates");
  collectPackageAssetRecords(check, loaded, sourcePath, "skills");
  collectThemes(check, loaded, sourcePath);
  collectFileIconThemes(check, loaded, sourcePath);
};

const themeTokenMap = {
  "editor.background": ["colors.bg", "colors.bg.code"],
  "editor.foreground": ["colors.fg"],
  "sideBar.background": ["colors.bg.panel"],
  "panel.background": ["colors.bg.panel"],
  focusBorder: ["colors.border.accent"],
  foreground: ["colors.fg"],
  descriptionForeground: ["colors.fg.muted"],
  border: ["colors.border"],
} satisfies Record<string, string[]>;

const getVsCodeTokenPath = (token: string) => `colors.vscode.${token}`;

const stripJsonComments = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const stripTrailingCommas = (value: string) => value.replace(/,\s*([}\]])/g, "$1");

const assetPath = (asset: unknown) => {
  if (!isRecord(asset) || asset.kind !== "package-asset" || typeof asset.path !== "string") return null;
  if (typeof asset.baseUrl !== "string" || !asset.baseUrl.startsWith("file:")) return null;
  return fileURLToPath(new URL(asset.path, asset.baseUrl));
};

const isInside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const validateAppearancePackageAsset = (
  check: ExtensionsCheckResponse,
  asset: unknown,
  input: { code: string; extensionId: string; message: string; sourcePath: string },
) => {
  validatePackageAsset(check, asset, input);
  if (!isRecord(asset) || asset.kind !== "package-asset" || typeof asset.path !== "string") return false;
  if (asset.path.includes("\0") || isAbsolute(asset.path)) {
    addDiagnostic(check, {
      code: input.code,
      extensionId: input.extensionId,
      message: `${input.message} must be a relative package asset path`,
      severity: "error",
      sourcePath: input.sourcePath,
    });
    return false;
  }
  if (typeof asset.baseUrl !== "string" || !asset.baseUrl.startsWith("file:")) return true;

  const declaredBasePath = fileURLToPath(new URL(asset.baseUrl));
  const baseDir = dirname(declaredBasePath);
  const resolvedAssetPath = resolve(baseDir, ...asset.path.split(/[\\/]+/));

  if (isInside(baseDir, resolvedAssetPath)) return true;

  addDiagnostic(check, {
    code: input.code,
    extensionId: input.extensionId,
    message: `${input.message} must stay under the extension asset root`,
    severity: "error",
    sourcePath: input.sourcePath,
  });
  return false;
};

const readJsoncAsset = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  asset: unknown,
  code: string,
) => {
  const path = assetPath(asset);
  if (!path || !existsSync(path)) return {};

  try {
    const parsed = JSON.parse(stripTrailingCommas(stripJsonComments(readFileSync(path, "utf8")))) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch (error) {
    addDiagnostic(check, {
      code,
      extensionId: loaded.metadata.id,
      message: `Appearance asset could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      severity: "error",
      sourcePath,
    });
    return {};
  }
};

const createThemeTokens = (theme: Record<string, unknown>) => {
  const tokens: Record<string, string> = {};
  const colors = isRecord(theme.colors) ? theme.colors : {};

  for (const [vsCodeToken, value] of Object.entries(colors)) {
    if (typeof value === "string") tokens[getVsCodeTokenPath(vsCodeToken)] = value;
  }

  for (const [vsCodeToken, tokenPaths] of Object.entries(themeTokenMap)) {
    const value = colors[vsCodeToken];
    if (typeof value !== "string") continue;
    for (const tokenPath of tokenPaths) tokens[tokenPath] = value;
  }

  return tokens;
};

const inferThemeMode = (theme: Record<string, unknown>, fallback: unknown) => {
  if (fallback === "light" || fallback === "dark") return fallback;
  const colors = isRecord(theme.colors) ? theme.colors : {};
  const background = typeof colors["editor.background"] === "string" ? colors["editor.background"] : "";
  return background.toLowerCase() < "#808080" ? "dark" : "light";
};

const stripHash = (value: string) => value.replace(/^#/, "");

const createMonacoRules = (theme: Record<string, unknown>) => {
  if (!Array.isArray(theme.tokenColors)) return [];

  return theme.tokenColors.flatMap((tokenColor) => {
    if (!isRecord(tokenColor) || !isRecord(tokenColor.settings)) return [];
    const settings = tokenColor.settings;
    const scopes = Array.isArray(tokenColor.scope)
      ? tokenColor.scope.filter((scope): scope is string => typeof scope === "string")
      : typeof tokenColor.scope === "string"
        ? [tokenColor.scope]
        : [];
    return scopes.map((scope) => ({
      token: scope,
      ...(typeof settings.foreground === "string" ? { foreground: stripHash(settings.foreground) } : {}),
      ...(typeof settings.fontStyle === "string" ? { fontStyle: settings.fontStyle } : {}),
    }));
  });
};

const collectThemes = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const themes = loaded.definition.themes;
  if (!isRecord(themes)) return;

  for (const [key, theme] of Object.entries(themes)) {
    if (!isRecord(theme) || typeof theme.title !== "string") continue;
    if (theme.format !== "vscode-color-theme") {
      addDiagnostic(check, {
        code: "unsupported_theme_format",
        extensionId: loaded.metadata.id,
        message: `Theme ${key} uses unsupported format ${String(theme.format)}`,
        severity: "error",
        sourcePath,
      });
      continue;
    }
    const validAsset = validateAppearancePackageAsset(check, theme.source, {
      code: "theme_source_invalid",
      extensionId: loaded.metadata.id,
      message: `theme ${key} source`,
      sourcePath,
    });
    if (!validAsset) continue;
    const parsed = readJsoncAsset(check, loaded, sourcePath, theme.source, "malformed_theme_asset");
    const mode = inferThemeMode(parsed, theme.mode);
    const colors = isRecord(parsed.colors) ? (parsed.colors as Record<string, string>) : {};
    check.themes.push({
      id: `${loaded.metadata.name}.${key}`,
      extensionId: loaded.metadata.id,
      title: theme.title,
      ...(typeof theme.description === "string" ? { description: theme.description } : {}),
      format: "vscode-color-theme",
      mode,
      source: theme.source as never,
      tokens: createThemeTokens(parsed),
      monacoTheme: {
        base: mode === "dark" ? "vs-dark" : "vs",
        inherit: true,
        rules: createMonacoRules(parsed),
        colors,
      },
    });
  }
};

const safeRelativeAsset = (path: string) => {
  const normalized = normalize(path);
  return !path.includes("\0") && !isAbsolute(path) && normalized !== ".." && !normalized.startsWith(`..${"/"}`);
};

const validateIconThemeFonts = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  themeAsset: unknown,
  iconTheme: Record<string, unknown>,
) => {
  const root = assetPath(themeAsset);
  if (!root || !Array.isArray(iconTheme.fonts)) return;
  for (const font of iconTheme.fonts) {
    if (!isRecord(font) || !Array.isArray(font.src)) continue;
    for (const src of font.src) {
      if (!isRecord(src) || typeof src.path !== "string") continue;
      if (safeRelativeAsset(src.path) && existsSync(resolve(dirname(root), src.path))) continue;
      addDiagnostic(check, {
        code: "invalid_file_icon_theme_font_asset",
        extensionId: loaded.metadata.id,
        message: `File icon theme font asset is unavailable: ${src.path}`,
        severity: "error",
        sourcePath,
      });
    }
  }
};

const collectFileIconThemes = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const iconThemes = loaded.definition.fileIconThemes;
  if (!isRecord(iconThemes)) return;

  for (const [key, iconTheme] of Object.entries(iconThemes)) {
    if (!isRecord(iconTheme) || typeof iconTheme.title !== "string") {
      continue;
    }
    if (iconTheme.format !== "vscode-file-icon-theme") {
      addDiagnostic(check, {
        code: "unsupported_file_icon_theme_format",
        extensionId: loaded.metadata.id,
        message: `File icon theme ${key} uses unsupported format ${String(iconTheme.format)}`,
        severity: "error",
        sourcePath,
      });
      continue;
    }
    const validAsset = validateAppearancePackageAsset(check, iconTheme.source, {
      code: "file_icon_theme_source_invalid",
      extensionId: loaded.metadata.id,
      message: `file icon theme ${key} source`,
      sourcePath,
    });
    if (!validAsset) continue;
    const parsed = readJsoncAsset(check, loaded, sourcePath, iconTheme.source, "malformed_file_icon_theme_asset");
    validateIconThemeFonts(check, loaded, sourcePath, iconTheme.source, parsed);
    check.fileIconThemes.push({
      id: `${loaded.metadata.name}.${key}`,
      extensionId: loaded.metadata.id,
      title: iconTheme.title,
      ...(typeof iconTheme.description === "string" ? { description: iconTheme.description } : {}),
      format: "vscode-file-icon-theme",
      source: iconTheme.source as never,
      definitions: isRecord(parsed.iconDefinitions) ? parsed.iconDefinitions : {},
      fileExtensions: isRecord(parsed.fileExtensions) ? (parsed.fileExtensions as Record<string, string>) : {},
      fileNames: isRecord(parsed.fileNames) ? (parsed.fileNames as Record<string, string>) : {},
    });
  }
};

const webviewContributionMaps = [
  "activityRenderers",
  "routes",
  "sessionAnchorRenderers",
  "settingsPanels",
  "views",
] as const;

const validateWebviewContributionEntries = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
) => {
  for (const mapKey of webviewContributionMaps) {
    const contributions = loaded.definition[mapKey];
    if (!isRecord(contributions)) continue;

    for (const [key, contribution] of Object.entries(contributions)) {
      if (!isRecord(contribution) || !isRecord(contribution.webview)) continue;
      validateWebviewEntry(check, contribution.webview.entry, {
        code: `${mapKey === "routes" ? "route" : mapKey}_webview`,
        extensionId: loaded.metadata.id,
        message: `${mapKey} ${key} webview entry`,
        sourcePath,
      });

      if (Array.isArray(contribution.webview.capabilities)) {
        for (const diagnostic of validateWebviewCapabilityNames(contribution.webview.capabilities)) {
          addDiagnostic(check, {
            code: diagnostic.code,
            extensionId: loaded.metadata.id,
            message: diagnostic.message,
            severity: diagnostic.severity,
            sourcePath,
          });
        }
      }
    }
  }
};

const collectArtifactMounts = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const artifactMounts = loaded.definition.artifactMounts;
  if (!isRecord(artifactMounts)) return;

  for (const [key, mount] of Object.entries(artifactMounts)) {
    if (!isRecord(mount) || typeof mount.path !== "string" || typeof mount.label !== "string") continue;
    if (!validateArtifactPath(mount.path)) {
      addDiagnostic(check, {
        code: "artifact_mount_path_invalid",
        extensionId: loaded.metadata.id,
        message: `Artifact mount ${key} must stay under .pstdio/${loaded.metadata.name}`,
        severity: "error",
        sourcePath,
      });
    }
    check.artifactMounts.push({
      id: `${loaded.metadata.name}.${key}`,
      extensionId: loaded.metadata.id,
      fullPath: `.pstdio/${loaded.metadata.name}/${mount.path}`,
      label: mount.label,
      relativePath: mount.path,
    });
  }
};

const collectRoutes = (check: ExtensionsCheckResponse, loaded: LoadedExtension) => {
  const routes = loaded.definition.routes;
  if (!isRecord(routes)) return;

  for (const [key, route] of Object.entries(routes)) {
    if (!isRecord(route) || !isRecord(route.webview)) continue;
    check.routes.push({
      id: `${loaded.metadata.name}.${key}`,
      extensionId: loaded.metadata.id,
      label: typeof route.label === "string" ? route.label : key,
      path: typeof route.path === "string" ? route.path : key,
      webview: route.webview as ExtensionRouteRecord["webview"],
    });
  }
};

const collectNavigation = (check: ExtensionsCheckResponse, loaded: LoadedExtension) => {
  const navigation = loaded.definition.navigation;
  if (!isRecord(navigation)) return;

  for (const [key, item] of Object.entries(navigation)) {
    if (!isRecord(item)) continue;
    check.navigation.push({
      id: `${loaded.metadata.name}.${key}`,
      extensionId: loaded.metadata.id,
      label: typeof item.label === "string" ? item.label : key,
      slotId: slotId(item.slot),
    });
  }
};

const collectPackageAssetRecords = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  key: "skills" | "templates",
) => {
  const contributions = loaded.definition[key];
  if (!isRecord(contributions)) return;

  for (const [name, contribution] of Object.entries(contributions)) {
    if (!isRecord(contribution)) continue;
    validatePackageAsset(check, contribution.source, {
      code: `${key}_source_invalid`,
      extensionId: loaded.metadata.id,
      message: `${key.slice(0, -1)} ${name} source`,
      sourcePath,
    });
    check[key].push({ id: `${loaded.metadata.name}.${name}`, extensionId: loaded.metadata.id });
  }
};
