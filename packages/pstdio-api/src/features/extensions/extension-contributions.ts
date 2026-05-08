import type { ExtensionRouteRecord, ExtensionsCheckResponse } from "pstdio-api-contracts";
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
    const id = `${loaded.metadata.namespace}.${key}`;
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
  const id = `${loaded.metadata.namespace}.${key}`;
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
    cliPath: cliPathForCommand(loaded.metadata.namespace, key, command.cli),
    description: typeof command.description === "string" ? command.description : undefined,
    extensionId: loaded.metadata.id,
    namespace: loaded.metadata.namespace,
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

  const commandId = `${loaded.metadata.namespace}.${key}`;
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
      id: `${loaded.metadata.namespace}.${key}`,
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
      check.hooks.push({ id: `${loaded.metadata.namespace}.${key}`, eventId, extensionId: loaded.metadata.id });
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
        id: `${loaded.metadata.namespace}.${key}`,
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
        message: `Artifact mount ${key} must stay under .pstdio/${loaded.metadata.namespace}`,
        severity: "error",
        sourcePath,
      });
    }
    check.artifactMounts.push({
      id: `${loaded.metadata.namespace}.${key}`,
      extensionId: loaded.metadata.id,
      fullPath: `.pstdio/${loaded.metadata.namespace}/${mount.path}`,
      label: mount.label,
      namespace: loaded.metadata.namespace,
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
      id: `${loaded.metadata.namespace}.${key}`,
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
      id: `${loaded.metadata.namespace}.${key}`,
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
    check[key].push({ id: `${loaded.metadata.namespace}.${name}`, extensionId: loaded.metadata.id });
  }
};
