import type {
  ExtensionCommandPaletteContribution,
  ExtensionControlsRendererRecord,
  ExtensionDataRendererRecord,
  ExtensionDataTableRendererRecord,
  ExtensionFileIconThemeRecord,
  ExtensionMenuContribution,
  ExtensionRouteRecord,
  ExtensionSettingsPanelRecord,
  ExtensionsCheckResponse,
  ExtensionThemeRecord,
  ExtensionTreeItemContribution,
} from "pstdio-api-contracts";
import type { ExtensionRuntime } from "pstdio-extensions";
import { toCommandRecord } from "./extension-command-runtime";
import {
  toCommandPaletteResourceRecord,
  toDataRendererRecord,
  toDataTableRendererRecord,
  toTreeItemRecord,
} from "./workbench-extension-contributions";

export { collectCheckModes } from "./check-modes-from-runtime";

const localizedString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "$l10n" in value) {
    const localized = value as { $l10n: string; default?: string };
    return typeof localized.default === "string" ? localized.default : localized.$l10n;
  }
  return undefined;
};

const displayString = (value: unknown, fallback: string) => localizedString(value) ?? fallback;

const refIdOf = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return undefined;
};

const includesWhenValue = (value: string | string[] | undefined, expected: string) =>
  Array.isArray(value) ? value.includes(expected) : value === expected;

const legacyMenuSlotId = (menu: ExtensionRuntime["commands"][number]["menus"][number]) => {
  const slotId = refIdOf(menu.slot);
  if (slotId) return slotId;

  const when = menu.when as ExtensionMenuContribution["when"] | undefined;
  const resourceTypes = when?.resourceType ?? [];
  const header =
    menu.target === "workbench.nav.actions"
      ? "headerPrimary"
      : menu.target === "workbench.nav.overflow"
        ? "headerOverflow"
        : undefined;

  if (!header) return "unknown";
  if (resourceTypes.includes("workspace") || includesWhenValue(when?.mode, "workspace")) return `workspace.${header}`;
  if (resourceTypes.includes("session") || includesWhenValue(when?.mode, "sessions")) return `session.${header}`;
  return `project.${header}`;
};

const legacySettingsSlotId = (panel: ExtensionRuntime["settingsPanels"][number]["contribution"]) => {
  const slotId = refIdOf(panel.slot);
  if (slotId) return slotId;
  return panel.scope === "global" ? "global.settingsPanels" : "project.settingsPanels";
};

const legacyViewSlotId = (view: ExtensionRuntime["views"][number]["contribution"]) =>
  refIdOf(view.slot) ?? view.target ?? "unknown";

const compact = <T>(items: Array<T | null | undefined>) => items.filter((item): item is T => item != null);

export const toCheckCommands = (commands: ExtensionRuntime["commands"]) => commands.map(toCommandRecord);

export const toCheckMenuContributions = (commands: ExtensionRuntime["commands"]): ExtensionMenuContribution[] => {
  const records: ExtensionMenuContribution[] = [];
  for (const command of commands) {
    command.menus.forEach((menu, index) => {
      records.push({
        id: `${command.id}.menu.${index}`,
        extensionId: command.extensionId,
        commandId: refIdOf(menu.command) ?? command.id,
        slotId: legacyMenuSlotId(menu),
        target: menu.target,
        label: menu.label ?? command.title,
        group: menu.group,
        placement: menu.placement,
        icon: menu.icon,
        presentation: menu.presentation,
        params: menu.params as Record<string, unknown> | undefined,
        when: menu.when as ExtensionMenuContribution["when"],
      });
    });
  }
  return records;
};

export const toCheckPaletteContributions = (
  commands: ExtensionRuntime["commands"],
): ExtensionCommandPaletteContribution[] => {
  const records: ExtensionCommandPaletteContribution[] = [];
  for (const command of commands) {
    command.palette.forEach((palette, index) => {
      records.push({
        id: `${command.id}.palette.${index}`,
        extensionId: command.extensionId,
        commandId: command.id,
        label: palette.label ?? command.title,
        group: palette.group,
        placement: palette.placement,
        icon: palette.icon,
        params: palette.params as Record<string, unknown> | undefined,
        when: palette.when as ExtensionCommandPaletteContribution["when"],
      });
    });
  }
  return records;
};

export const toCheckMiddlewares = (middlewares: ExtensionRuntime["middlewares"]) =>
  middlewares.map((middleware) => ({
    id: middleware.id,
    commandId: middleware.commandId,
    extensionId: middleware.extensionId,
  }));

export const toCheckHooks = (hooks: ExtensionRuntime["hooks"]) =>
  hooks.map((hook) => ({
    id: hook.id,
    eventId: hook.eventId,
    extensionId: hook.extensionId,
  }));

export const toCheckSchedules = (schedules: ExtensionRuntime["schedules"]) =>
  schedules.map((schedule) => ({
    id: schedule.id,
    commandId: schedule.commandId,
    cron: schedule.cron,
    extensionId: schedule.extensionId,
  }));

export const toCheckArtifactMounts = (artifactMounts: ExtensionRuntime["artifactMounts"]) =>
  artifactMounts.map((mount) => ({
    id: mount.id,
    extensionId: mount.extensionId,
    fullPath: mount.fullPath,
    label: mount.label,
    relativePath: mount.relativePath,
  }));

export const toCheckRoutes = (routes: ExtensionRuntime["routes"]): ExtensionRouteRecord[] =>
  routes.map((route) => ({
    id: route.id,
    extensionId: route.extensionId,
    label: route.contribution.label,
    path: typeof route.contribution.path === "string" ? route.contribution.path : route.localId,
    webview: route.contribution.webview as ExtensionRouteRecord["webview"],
  }));

const toViewRecord = (view: ExtensionRuntime["views"][number]) => ({
  id: view.id,
  extensionId: view.extensionId,
  slotId: legacyViewSlotId(view.contribution),
  target: view.contribution.target,
  title: view.contribution.title,
  group: view.contribution.group,
  placement: view.contribution.placement,
  resourceKind: view.contribution.resourceKind,
  surface: view.contribution.surface,
  hostTreeHeader: view.contribution.hostTreeHeader,
  hostTreeFooter: view.contribution.hostTreeFooter,
  webview: view.contribution.webview,
  treeRendererId:
    typeof view.contribution.treeRenderer === "string"
      ? resolveContributionId(view.name, view.contribution.treeRenderer)
      : undefined,
  fileRendererId:
    typeof view.contribution.fileRenderer === "string"
      ? resolveContributionId(view.name, view.contribution.fileRenderer)
      : undefined,
  controlsRendererId:
    typeof view.contribution.controlsRenderer === "string"
      ? resolveContributionId(view.name, view.contribution.controlsRenderer)
      : undefined,
  dataTableRendererId:
    typeof view.contribution.dataTableRenderer === "string"
      ? resolveContributionId(view.name, view.contribution.dataTableRenderer)
      : undefined,
});

const resolveContributionId = (extensionName: string, localOrFullId: string) =>
  localOrFullId.startsWith(`${extensionName}.`) ? localOrFullId : `${extensionName}.${localOrFullId}`;

export const toCheckViews = (views: ExtensionRuntime["views"]) =>
  views.map(toViewRecord) as ExtensionsCheckResponse["views"];

export const toCheckSettingsPanels = (panels: ExtensionRuntime["settingsPanels"]): ExtensionSettingsPanelRecord[] =>
  panels.map((panel) => ({
    id: panel.id,
    extensionId: panel.extensionId,
    slotId: legacySettingsSlotId(panel.contribution),
    target: panel.contribution.target,
    scope:
      panel.contribution.scope === "project" || panel.contribution.scope === "global"
        ? panel.contribution.scope
        : undefined,
    title: panel.contribution.title,
    icon: panel.contribution.icon,
    webview: panel.contribution.webview as ExtensionSettingsPanelRecord["webview"],
  }));

export const toCheckSettingsDefinitions = (settings: ExtensionRuntime["settings"]) =>
  settings.map((setting) => ({
    key: setting.key,
    extensionId: setting.extensionId,
    type: setting.contribution.type,
    scope: setting.contribution.scope,
    default: setting.contribution.default,
    enum: setting.contribution.enum,
    title: setting.contribution.title,
    description: setting.contribution.description,
  }));

export const toCheckTreeItems = (treeItems: ExtensionRuntime["treeItems"]): ExtensionTreeItemContribution[] =>
  treeItems.map(toTreeItemRecord);

export const toCheckDataRenderers = (renderers: ExtensionRuntime["dataRenderers"]): ExtensionDataRendererRecord[] =>
  compact(renderers.map(toDataRendererRecord));

export const toCheckDataTableRenderers = (
  renderers: ExtensionRuntime["dataTableRenderers"],
): ExtensionDataTableRendererRecord[] => compact(renderers.map(toDataTableRendererRecord));

export const toCheckCommandPaletteResources = (resources: ExtensionRuntime["commandPaletteResources"]) =>
  compact(resources.map(toCommandPaletteResourceRecord));

export const toCheckControlsRenderers = (
  renderers: ExtensionRuntime["controlsRenderers"],
): ExtensionControlsRendererRecord[] =>
  compact(
    renderers.map((renderer) => {
      const queryCommandId = refIdOf(renderer.contribution.queryCommand);
      if (!queryCommandId) return null;

      const refreshEventIds = compact(renderer.contribution.refreshEvents?.map(refIdOf) ?? []);

      return {
        id: renderer.id,
        extensionId: renderer.extensionId,
        title: renderer.contribution.title,
        queryCommandId,
        updateValueCommandId: refIdOf(renderer.contribution.updateValueCommand),
        applyCommandId: refIdOf(renderer.contribution.applyCommand),
        resetCommandId: refIdOf(renderer.contribution.resetCommand),
        ...(refreshEventIds.length > 0 ? { refreshEventIds } : {}),
        defaultValues: renderer.contribution.defaultValues,
        emptyTitle: renderer.contribution.emptyTitle,
        emptyDescription: renderer.contribution.emptyDescription,
      };
    }),
  );

export const toCheckTreeRenderers = (renderers: ExtensionRuntime["treeRenderers"]) =>
  compact(
    renderers.map((renderer) => {
      const bodyCommandId = refIdOf(renderer.contribution.bodyCommand);
      if (!bodyCommandId) return null;
      return {
        id: renderer.id,
        extensionId: renderer.extensionId,
        title: renderer.contribution.title,
        icon: renderer.contribution.icon,
        bodyCommandId,
        childrenCommandId: refIdOf(renderer.contribution.childrenCommand),
        footerCommandId: refIdOf(renderer.contribution.footerCommand),
        defaultExpandedSectionIds: renderer.contribution.defaultExpandedSectionIds,
        defaultExpandedNodeIds: renderer.contribution.defaultExpandedNodeIds,
      };
    }),
  );

export const toCheckFileRenderers = (renderers: ExtensionRuntime["fileRenderers"]) =>
  compact(
    renderers.map((renderer) => {
      const loadCommandId = refIdOf(renderer.contribution.loadCommand);
      if (!loadCommandId) return null;
      return {
        id: renderer.id,
        extensionId: renderer.extensionId,
        title: renderer.contribution.title,
        icon: renderer.contribution.icon,
        resourceKind: renderer.contribution.resourceKind,
        loadCommandId,
        saveCommandId: refIdOf(renderer.contribution.saveCommand),
      };
    }),
  );

export const toCheckThemes = (themes: ExtensionRuntime["themes"]): ExtensionThemeRecord[] =>
  themes.map((theme) => {
    const description = localizedString(theme.description);
    return {
      id: theme.id,
      extensionId: theme.extensionId,
      title: displayString(theme.title, theme.localId),
      ...(description ? { description } : {}),
      format: "vscode-color-theme" as const,
      mode: theme.mode,
      source: theme.source as ExtensionThemeRecord["source"],
      tokens: theme.preference.tokens,
      monacoTheme: theme.monacoTheme,
    };
  });

export const toCheckFileIconThemes = (themes: ExtensionRuntime["fileIconThemes"]): ExtensionFileIconThemeRecord[] =>
  themes.map((theme) => {
    const description = localizedString(theme.description);
    return {
      id: theme.id,
      extensionId: theme.extensionId,
      title: displayString(theme.title, theme.localId),
      ...(description ? { description } : {}),
      format: "vscode-file-icon-theme" as const,
      source: theme.source as ExtensionFileIconThemeRecord["source"],
      definitions: theme.definitions,
      fileExtensions: theme.fileExtensions,
      fileNames: theme.fileNames,
      defaults: theme.defaults,
      fonts: theme.fonts,
    };
  });

export const toCheckTemplates = (templates: ExtensionRuntime["templates"]) =>
  templates.map((template) => ({ id: template.id, extensionId: template.extensionId }));

export const toCheckSkills = (skills: ExtensionRuntime["skills"]) =>
  skills.map((skill) => ({ id: skill.id, extensionId: skill.extensionId }));
