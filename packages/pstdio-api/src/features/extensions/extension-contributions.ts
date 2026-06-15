import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ExtensionCommandPaletteContribution,
  ExtensionDataRendererRecord,
  ExtensionRouteRecord,
  ExtensionSettingDefinitionRecord,
  ExtensionSettingsPanelRecord,
  ExtensionsCheckResponse,
  ExtensionTreeItemContribution,
} from "pstdio-api-contracts";
import {
  getWorkbenchTargetDefinition,
  type WorkbenchContributionKind,
  workbenchTargets,
} from "pstdio-api-contracts/extension-kernel";
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
import { normalizeModeLayout, reservedDashboardModeIds, resolveModeId } from "./extension-mode-layout";
import type { LoadedExtension } from "./extension-runtime";
import { collectFileRenderers, collectTreeRenderers, collectViews } from "./extension-tree-view-contributions";

const cliPathForCommand = (namespace: string, key: string, cli: unknown) => {
  if (cli === false) return undefined;
  if (isRecord(cli) && Array.isArray(cli.path) && cli.path.every((part) => typeof part === "string")) {
    return [namespace, ...cli.path].join(" ");
  }
  return [namespace, ...key.split(".")].join(" ");
};

const cliAliasesForCommand = (cli: unknown) => {
  if (!isRecord(cli) || !Array.isArray(cli.globalAliases)) return undefined;
  return cli.globalAliases
    .filter((alias): alias is string[] => Array.isArray(alias) && alias.every((part) => typeof part === "string"))
    .map((alias) => alias.join(" "));
};

const supportedTargetsFor = (kind: WorkbenchContributionKind) =>
  workbenchTargets
    .filter((target) => (target.allowedKinds as readonly WorkbenchContributionKind[]).includes(kind))
    .map((target) => target.id);

const hasCompatibleWorkbenchTarget = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  input: { contributionId: string; expectedKind: WorkbenchContributionKind; target: unknown },
) => {
  if (typeof input.target !== "string") return true;

  const definition = getWorkbenchTargetDefinition(input.target);
  if (!definition) {
    addDiagnostic(check, {
      code: "extension_target_invalid",
      extensionId: loaded.metadata.id,
      message: `Contribution "${input.contributionId}" targets unknown workbench target "${input.target}"`,
      severity: "error",
      sourcePath,
      metadata: {
        contributionId: input.contributionId,
        expectedKind: input.expectedKind,
        supportedTargets: supportedTargetsFor(input.expectedKind),
        target: input.target,
      },
    });
    return false;
  }

  if ((definition.allowedKinds as readonly WorkbenchContributionKind[]).includes(input.expectedKind)) return true;

  addDiagnostic(check, {
    code: "extension_target_unsupported",
    extensionId: loaded.metadata.id,
    message: `Contribution "${input.contributionId}" targets "${input.target}" as ${input.expectedKind}; supported targets are ${supportedTargetsFor(input.expectedKind).join(", ")}`,
    severity: "error",
    sourcePath,
    metadata: {
      contributionId: input.contributionId,
      expectedKind: input.expectedKind,
      supportedTargets: supportedTargetsFor(input.expectedKind),
      target: input.target,
    },
  });
  return false;
};

const hasRequiredWorkbenchTarget = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  input: { contributionId: string; expectedKind: WorkbenchContributionKind; target: unknown },
) => {
  if (typeof input.target === "string") return hasCompatibleWorkbenchTarget(check, loaded, sourcePath, input);

  addDiagnostic(check, {
    code: "extension_target_invalid",
    extensionId: loaded.metadata.id,
    message: `Contribution "${input.contributionId}" must declare a workbench target`,
    severity: "error",
    sourcePath,
    metadata: {
      contributionId: input.contributionId,
      expectedKind: input.expectedKind,
      supportedTargets: supportedTargetsFor(input.expectedKind),
    },
  });
  return false;
};

const modeIncludes = (mode: unknown, expected: string) =>
  Array.isArray(mode) ? mode.includes(expected) : mode === expected;

const legacyMenuSlotId = (menu: Record<string, unknown>) => {
  if (menu.slot !== undefined) return slotId(menu.slot);
  const when = isRecord(menu.when) ? menu.when : undefined;
  const resourceTypes = Array.isArray(when?.resourceType) ? when.resourceType : [];
  const header =
    menu.target === "workbench.nav.actions"
      ? "headerPrimary"
      : menu.target === "workbench.nav.overflow"
        ? "headerOverflow"
        : undefined;
  if (!header) return "unknown";
  if (resourceTypes.includes("workspace") || modeIncludes(when?.mode, "workspace")) return `workspace.${header}`;
  if (resourceTypes.includes("session") || modeIncludes(when?.mode, "sessions")) return `session.${header}`;
  return `project.${header}`;
};

const legacySettingsSlotId = (panel: Record<string, unknown>) => {
  if (panel.slot !== undefined) return slotId(panel.slot);
  return panel.scope === "global" ? "global.settingsPanels" : "project.settingsPanels";
};

const placements = ["first", "default", "last"] as const;
const presentations = ["menu-item", "button", "icon-button"] as const;
const settingTypes = ["boolean", "number", "string", "array", "object"] as const;
const settingScopes = ["global", "project"] as const;

const localizableString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (!isRecord(value) || typeof value.$l10n !== "string") return undefined;
  return typeof value.default === "string" ? value.default : value.$l10n;
};

const displayString = (value: unknown, fallback: string) => localizableString(value) ?? fallback;

const placementOf = (value: unknown) =>
  placements.includes(value as (typeof placements)[number]) ? (value as (typeof placements)[number]) : undefined;

const presentationOf = (value: unknown) =>
  presentations.includes(value as (typeof presentations)[number])
    ? (value as (typeof presentations)[number])
    : undefined;

const settingTypeOf = (value: unknown) =>
  settingTypes.includes(value as (typeof settingTypes)[number]) ? (value as (typeof settingTypes)[number]) : undefined;

const settingScopeOf = (value: unknown) =>
  settingScopes.includes(value as (typeof settingScopes)[number])
    ? (value as (typeof settingScopes)[number])
    : undefined;

const hasOwn = (value: object, key: string) => Object.hasOwn(value, key);

const isSettingValueType = (type: (typeof settingTypes)[number], value: unknown) => {
  if (type === "boolean") return typeof value === "boolean";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "string") return typeof value === "string";
  if (type === "array") return Array.isArray(value);
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const reportInvalidSetting = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  key: string,
  message: string,
) => {
  addDiagnostic(check, {
    code: "extension_setting_invalid",
    extensionId: loaded.metadata.id,
    message,
    severity: "error",
    sourcePath,
    metadata: { key },
  });
};

const reportInvalidSettingScope = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  key: string,
) => {
  addDiagnostic(check, {
    code: "extension_settings_scope_invalid",
    extensionId: loaded.metadata.id,
    message: `Extension setting "${key}" must declare scope "project" or "global"`,
    severity: "error",
    sourcePath,
    metadata: { key },
  });
};

const settingDefinitionFrom = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  key: string,
  setting: unknown,
): ExtensionSettingDefinitionRecord | null => {
  if (!isRecord(setting)) {
    reportInvalidSetting(check, loaded, sourcePath, key, `Extension setting "${key}" must be an object`);
    return null;
  }

  const scope = settingScopeOf(setting.scope);
  if (!scope) {
    reportInvalidSettingScope(check, loaded, sourcePath, key);
    return null;
  }

  const type = settingTypeOf(setting.type);
  if (!type) {
    reportInvalidSetting(check, loaded, sourcePath, key, `Extension setting "${key}" must declare a supported type`);
    return null;
  }

  if (hasOwn(setting, "default") && !isSettingValueType(type, setting.default)) {
    reportInvalidSetting(
      check,
      loaded,
      sourcePath,
      key,
      `Extension setting "${key}" default must match type "${type}"`,
    );
    return null;
  }

  if (
    setting.enum !== undefined &&
    (!Array.isArray(setting.enum) || setting.enum.some((value) => !isSettingValueType(type, value)))
  ) {
    reportInvalidSetting(
      check,
      loaded,
      sourcePath,
      key,
      `Extension setting "${key}" enum values must match type "${type}"`,
    );
    return null;
  }

  return {
    key,
    extensionId: loaded.metadata.id,
    type,
    scope,
    default: hasOwn(setting, "default") ? setting.default : undefined,
    enum: Array.isArray(setting.enum) ? setting.enum : undefined,
    title: localizableString(setting.title),
    description: localizableString(setting.description),
  };
};

const collectSettings = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const settings = loaded.definition.settings;
  if (!isRecord(settings) || !isRecord(settings.properties)) return;

  for (const [key, setting] of Object.entries(settings.properties)) {
    const definition = settingDefinitionFrom(check, loaded, sourcePath, key, setting);
    if (definition) check.settingsDefinitions?.push(definition);
  }
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
  if (!localizableString(command.title) || typeof command.run !== "function") {
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
    cliAliases: cliAliasesForCommand(command.cli),
    description: localizableString(command.description),
    extensionId: loaded.metadata.id,
    title: displayString(command.title, key),
  });

  collectCommandMenus(check, loaded, sourcePath, key, command);
  collectCommandPaletteContributions(check, loaded, key, command);
};

const menuContributionRecord = (input: {
  command: Record<string, unknown>;
  commandId: string;
  contributionId: string;
  key: string;
  loaded: LoadedExtension;
  menu: Record<string, unknown>;
}) => {
  const { command, commandId, contributionId, key, loaded, menu } = input;

  return {
    id: contributionId,
    commandId: commandIdFromRef(menu.command) ?? commandId,
    extensionId: loaded.metadata.id,
    label: displayString(menu.label, displayString(command.title, key)),
    slotId: legacyMenuSlotId(menu),
    group: typeof menu.group === "string" ? menu.group : undefined,
    placement: placementOf(menu.placement),
    icon: typeof menu.icon === "string" ? menu.icon : undefined,
    presentation: presentationOf(menu.presentation),
    params: isRecord(menu.params) ? menu.params : undefined,
    target: typeof menu.target === "string" ? (menu.target as never) : undefined,
    when: isRecord(menu.when) ? (menu.when as never) : undefined,
  };
};

const collectCommandMenus = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  key: string,
  command: Record<string, unknown>,
) => {
  if (!Array.isArray(command.menus)) return;

  const commandId = `${loaded.metadata.name}.${key}`;
  command.menus.forEach((menu, index) => {
    if (!isRecord(menu)) return;
    const contributionId = `${commandId}.menu.${index}`;
    if (
      !hasCompatibleWorkbenchTarget(check, loaded, sourcePath, {
        contributionId,
        expectedKind: "menu",
        target: menu.target,
      })
    ) {
      return;
    }
    check.menuContributions.push(menuContributionRecord({ command, commandId, contributionId, key, loaded, menu }));
  });
};

const paletteContributionsOf = (palette: unknown) => {
  if (palette === undefined || palette === false) return [];
  if (palette === true) return [{}];
  if (Array.isArray(palette)) return palette.filter(isRecord);
  return isRecord(palette) ? [palette] : [];
};

const commandPaletteContributionRecord = (input: {
  command: Record<string, unknown>;
  commandId: string;
  contributionId: string;
  key: string;
  loaded: LoadedExtension;
  palette: Record<string, unknown>;
}): ExtensionCommandPaletteContribution => {
  const { command, commandId, contributionId, key, loaded, palette } = input;

  return {
    id: contributionId,
    commandId,
    extensionId: loaded.metadata.id,
    label: displayString(palette.label, displayString(command.title, key)),
    group: typeof palette.group === "string" ? palette.group : undefined,
    placement: placementOf(palette.placement),
    icon: typeof palette.icon === "string" ? palette.icon : undefined,
    params: isRecord(palette.params) ? palette.params : undefined,
    when: isRecord(palette.when) ? (palette.when as never) : undefined,
  };
};

const collectCommandPaletteContributions = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  key: string,
  command: Record<string, unknown>,
) => {
  const commandId = `${loaded.metadata.name}.${key}`;
  paletteContributionsOf(command.palette).forEach((palette, index) => {
    check.commandPaletteContributions.push(
      commandPaletteContributionRecord({
        command,
        commandId,
        contributionId: `${commandId}.palette.${index}`,
        key,
        loaded,
        palette,
      }),
    );
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
  collectSettings(check, loaded, sourcePath);
  collectArtifactMounts(check, loaded, sourcePath);
  collectModes(check, loaded, sourcePath);
  collectTreeRenderers(check, loaded, sourcePath);
  collectFileRenderers(check, loaded, sourcePath);
  validateWebviewContributionEntries(check, loaded, sourcePath);
  collectViews(check, loaded, sourcePath);
  collectRoutes(check, loaded);
  collectDataRenderers(check, loaded);
  collectCommandPaletteResources(check, loaded);
  collectTreeItems(check, loaded, sourcePath);
  reportUnsupportedNavigation(check, loaded, sourcePath);
  collectSettingsPanels(check, loaded, sourcePath);
  collectPackageAssetRecords(check, loaded, sourcePath, "templates");
  collectPackageAssetRecords(check, loaded, sourcePath, "skills");
  collectThemes(check, loaded, sourcePath);
  collectFileIconThemes(check, loaded, sourcePath);
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
  "button.background": ["colors.bg.button.primary.default", "colors.bg.accent-primary.default"],
  "button.hoverBackground": ["colors.bg.button.primary.hover", "colors.bg.accent-primary.hover"],
  "button.foreground": ["colors.fg.button.primary.default"],
  focusBorder: ["colors.border.accent"],
  foreground: ["colors.fg"],
  descriptionForeground: ["colors.fg.muted"],
  disabledForeground: ["colors.fg.subtle"],
  border: ["colors.border", "colors.border.muted", "colors.border.subtle"],
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
    if (!isRecord(theme) || !localizableString(theme.title)) continue;
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
      title: displayString(theme.title, key),
      ...(localizableString(theme.description) ? { description: localizableString(theme.description) } : {}),
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
    if (!isRecord(iconTheme) || !localizableString(iconTheme.title)) {
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
      title: displayString(iconTheme.title, key),
      ...(localizableString(iconTheme.description) ? { description: localizableString(iconTheme.description) } : {}),
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
      label: displayString(route.label, key),
      path: typeof route.path === "string" ? route.path : key,
      webview: route.webview as ExtensionRouteRecord["webview"],
    });
  }
};

const resolveContributionId = (extensionName: string, localOrFullId: string) =>
  localOrFullId.startsWith(`${extensionName}.`) ? localOrFullId : `${extensionName}.${localOrFullId}`;

const stringValue = (value: unknown) => (typeof value === "string" ? value : undefined);

const booleanValue = (value: unknown) => (typeof value === "boolean" ? value : undefined);

const recordValue = <T>(value: unknown) => (isRecord(value) ? (value as T) : undefined);

const dataRendererAttributes = (value: unknown) =>
  Array.isArray(value) ? (value as ExtensionDataRendererRecord["attributes"]) : undefined;

const dataRendererCreateRow = (value: unknown): ExtensionDataRendererRecord["createRow"] => {
  if (!isRecord(value)) return undefined;
  const commandId = commandIdFromRef(value.command);
  if (!commandId) return undefined;
  return {
    commandId,
    title: localizableString(value.title),
    submitLabel: localizableString(value.submitLabel),
    columnParam: typeof value.columnParam === "string" ? value.columnParam : undefined,
    params: isRecord(value.params)
      ? (value.params as NonNullable<ExtensionDataRendererRecord["createRow"]>["params"])
      : undefined,
  };
};

const dataRendererRecord = (loaded: LoadedExtension, key: string, renderer: unknown) => {
  if (!isRecord(renderer) || !localizableString(renderer.title)) return undefined;
  const queryCommandId = commandIdFromRef(renderer.queryCommand);
  if (!queryCommandId) return undefined;
  return {
    id: `${loaded.metadata.name}.${key}`,
    extensionId: loaded.metadata.id,
    title: displayString(renderer.title, key),
    resourceKind: stringValue(renderer.resourceKind),
    attributes: dataRendererAttributes(renderer.attributes),
    queryCommandId,
    updateAttributeCommandId: commandIdFromRef(renderer.updateAttributeCommand) ?? undefined,
    reorderCommandId: commandIdFromRef(renderer.reorderCommand) ?? undefined,
    columnActionCommandId: commandIdFromRef(renderer.columnActionCommand) ?? undefined,
    createRow: dataRendererCreateRow(renderer.createRow),
    defaultSettings: recordValue<ExtensionDataRendererRecord["defaultSettings"]>(renderer.defaultSettings),
    defaultFilters: recordValue<ExtensionDataRendererRecord["defaultFilters"]>(renderer.defaultFilters),
    emptyTitle: localizableString(renderer.emptyTitle),
    emptyDescription: localizableString(renderer.emptyDescription),
    hideToolbar: booleanValue(renderer.hideToolbar),
    savedViews: recordValue<ExtensionDataRendererRecord["savedViews"]>(renderer.savedViews),
  };
};

const collectDataRenderers = (check: ExtensionsCheckResponse, loaded: LoadedExtension) => {
  const renderers = loaded.definition.dataRenderers;
  if (!isRecord(renderers)) return;

  for (const [key, renderer] of Object.entries(renderers)) {
    const record = dataRendererRecord(loaded, key, renderer);
    if (record) check.dataRenderers.push(record);
  }
};

const commandPaletteResourceRecord = (loaded: LoadedExtension, key: string, provider: unknown) => {
  if (!isRecord(provider) || !localizableString(provider.title)) return undefined;
  const queryCommandId = commandIdFromRef(provider.queryCommand);
  if (!queryCommandId) return undefined;
  const refreshEventIds = Array.isArray(provider.refreshEvents)
    ? provider.refreshEvents.map(eventIdFromRef).filter((id): id is string => Boolean(id))
    : undefined;
  return {
    id: `${loaded.metadata.name}.${key}`,
    extensionId: loaded.metadata.id,
    title: displayString(provider.title, key),
    resourceKind: stringValue(provider.resourceKind),
    queryCommandId,
    refreshEventIds: refreshEventIds && refreshEventIds.length > 0 ? refreshEventIds : undefined,
  };
};

const collectCommandPaletteResources = (check: ExtensionsCheckResponse, loaded: LoadedExtension) => {
  const providers = loaded.definition.commandPaletteResources;
  if (!isRecord(providers)) return;

  for (const [key, provider] of Object.entries(providers)) {
    const record = commandPaletteResourceRecord(loaded, key, provider);
    if (record) check.commandPaletteResources.push(record);
  }
};

const viewIdsByLocalId = (loaded: LoadedExtension) => {
  const views = loaded.definition.views;
  const ids = new Map<string, string>();
  if (!isRecord(views)) return ids;

  for (const [key, view] of Object.entries(views)) {
    if (isRecord(view) && localizableString(view.title)) ids.set(key, `${loaded.metadata.name}.${key}`);
  }

  return ids;
};

const collectModes = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const modes = loaded.definition.modes;
  if (!isRecord(modes)) return;
  const viewIds = viewIdsByLocalId(loaded);

  for (const [key, mode] of Object.entries(modes)) {
    if (!isRecord(mode) || !localizableString(mode.label)) continue;
    const modeId = resolveModeId({ extensionName: loaded.metadata.name, localId: key, id: mode.id });
    if (reservedDashboardModeIds.has(modeId)) {
      addDiagnostic(check, {
        code: "extension_mode_duplicate",
        extensionId: loaded.metadata.id,
        message: `Extension "${loaded.metadata.id}" declares duplicate workbench mode "${modeId}"`,
        metadata: { modeId },
        severity: "error",
        sourcePath,
      });
      continue;
    }
    const normalized = normalizeModeLayout({
      extensionId: loaded.metadata.id,
      extensionName: loaded.metadata.name,
      layout: mode.layout,
      modeId,
      sourcePath,
      viewIdsByLocalId: viewIds,
    });
    if (normalized.diagnostic) {
      addDiagnostic(check, normalized.diagnostic);
      continue;
    }
    check.modes.push({
      id: `${loaded.metadata.name}.${key}`,
      extensionId: loaded.metadata.id,
      modeId,
      label: displayString(mode.label, key),
      icon: typeof mode.icon === "string" ? mode.icon : undefined,
      layout: normalized.layout,
    });
  }
};

const reportUnsupportedNavigation = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const navigation = loaded.definition.navigation;
  if (!isRecord(navigation)) return;

  for (const [key, item] of Object.entries(navigation)) {
    if (!isRecord(item)) continue;
    const contributionId = `${loaded.metadata.name}.${key}`;
    addDiagnostic(check, {
      code: "extension_navigation_unsupported",
      extensionId: loaded.metadata.id,
      message: `Navigation contribution "${contributionId}" uses legacy slots; use treeItems with workbench targets instead`,
      metadata: { contributionId },
      severity: "error",
      sourcePath,
    });
  }
};

const treeItemAction = (extensionName: string, action: unknown): ExtensionTreeItemContribution["action"] | null => {
  if (!isRecord(action)) return null;
  if (action.kind === "route" && typeof action.route === "string") return { kind: "route", route: action.route };
  if (action.kind === "href" && typeof action.href === "string") return { kind: "href", href: action.href };
  if (action.kind === "dataRenderer" && typeof action.dataRenderer === "string") {
    return { kind: "dataRenderer", dataRendererId: resolveContributionId(extensionName, action.dataRenderer) };
  }
  const commandId = commandIdFromRef(action.command);
  if (action.kind === "command" && commandId) {
    return { kind: "command", commandId, args: isRecord(action.params) ? action.params : undefined };
  }
  return null;
};

const collectTreeItems = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const items = loaded.definition.treeItems;
  if (!isRecord(items)) return;

  for (const [key, item] of Object.entries(items)) {
    if (!isRecord(item) || !localizableString(item.label)) continue;
    const id = `${loaded.metadata.name}.${key}`;
    if (
      !hasRequiredWorkbenchTarget(check, loaded, sourcePath, {
        contributionId: id,
        expectedKind: "treeItem",
        target: item.target,
      })
    ) {
      continue;
    }
    const action = treeItemAction(loaded.metadata.name, item.action);
    if (!action || typeof item.target !== "string") continue;
    check.treeItems.push({
      id,
      extensionId: loaded.metadata.id,
      target: item.target as never,
      label: displayString(item.label, key),
      group: localizableString(item.group),
      placement: placementOf(item.placement),
      icon: typeof item.icon === "string" ? item.icon : undefined,
      action,
      when: isRecord(item.when) ? (item.when as ExtensionTreeItemContribution["when"]) : undefined,
    });
  }
};

const collectSettingsPanels = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const panels = loaded.definition.settingsPanels;
  if (!isRecord(panels)) return;

  for (const [key, panel] of Object.entries(panels)) {
    if (!isRecord(panel) || !localizableString(panel.title) || !isRecord(panel.webview)) continue;
    const id = `${loaded.metadata.name}.${key}`;
    if (
      !hasCompatibleWorkbenchTarget(check, loaded, sourcePath, {
        contributionId: id,
        expectedKind: "settings",
        target: panel.target,
      })
    ) {
      continue;
    }
    if (typeof panel.target === "string" && panel.scope !== "project" && panel.scope !== "global") {
      addDiagnostic(check, {
        code: "extension_settings_scope_invalid",
        extensionId: loaded.metadata.id,
        message: `Settings panel "${id}" must declare scope "project" or "global"`,
        severity: "error",
        sourcePath,
        metadata: { contributionId: id, target: panel.target },
      });
      continue;
    }
    check.settingsPanels.push({
      id,
      extensionId: loaded.metadata.id,
      slotId: legacySettingsSlotId(panel),
      target: typeof panel.target === "string" ? (panel.target as never) : undefined,
      scope: panel.scope === "project" || panel.scope === "global" ? panel.scope : undefined,
      title: displayString(panel.title, key),
      webview: panel.webview as ExtensionSettingsPanelRecord["webview"],
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
