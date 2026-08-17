import type {
  ExtensionCommandPaletteContribution,
  ExtensionControlsRendererRecord,
  ExtensionDataTableRendererRecord,
  ExtensionFileIconThemeRecord,
  ExtensionKanbanRendererRecord,
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
  toDataTableRendererRecord,
  toKanbanRendererRecord,
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

type RuntimePanelContribution = ExtensionRuntime["panels"][number]["contribution"];
type RuntimePanelMenuContribution = NonNullable<RuntimePanelContribution["panelMenus"]>[string];

const toPanelBody = (
  panel: ExtensionRuntime["panels"][number],
  contribution: RuntimePanelContribution | RuntimePanelMenuContribution,
) => ({
  webview: contribution.webview,
  treeRendererId:
    typeof contribution.treeRenderer === "string"
      ? resolveContributionId(panel.name, contribution.treeRenderer)
      : undefined,
  fileRendererId:
    typeof contribution.fileRenderer === "string"
      ? resolveContributionId(panel.name, contribution.fileRenderer)
      : undefined,
  controlsRendererId:
    typeof contribution.controlsRenderer === "string"
      ? resolveContributionId(panel.name, contribution.controlsRenderer)
      : undefined,
  dataTableRendererId:
    typeof contribution.dataTableRenderer === "string"
      ? resolveContributionId(panel.name, contribution.dataTableRenderer)
      : undefined,
});

const resolveContributionId = (extensionName: string, localOrFullId: string) =>
  localOrFullId.startsWith(`${extensionName}.`) ? localOrFullId : `${extensionName}.${localOrFullId}`;

const toPanelRecord = (panel: ExtensionRuntime["panels"][number]) => ({
  id: panel.id,
  extensionId: panel.extensionId,
  title: panel.contribution.title,
  region: panel.contribution.region,
  closable: panel.contribution.closable,
  group: panel.contribution.group,
  placement: panel.contribution.placement,
  resourceKind: panel.contribution.resourceKind,
  eligibleLocations: panel.contribution.eligibleLocations,
  panelMenus: Object.entries(panel.contribution.panelMenus ?? {}).map(([localId, menu]) => ({
    id: `${panel.id}.${localId}`,
    extensionId: panel.extensionId,
    ownerPanelId: panel.id,
    title: menu.title,
    side: menu.side,
    group: menu.group,
    placement: menu.placement,
    hostTreeHeader: menu.hostTreeHeader,
    hostTreeFooter: menu.hostTreeFooter,
    ...toPanelBody(panel, menu),
  })),
  ...toPanelBody(panel, panel.contribution),
});

export const toCheckPanels = (panels: ExtensionRuntime["panels"]) =>
  panels.map(toPanelRecord) as ExtensionsCheckResponse["panels"];

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

export const toCheckKanbanRenderers = (
  renderers: ExtensionRuntime["kanbanRenderers"],
): ExtensionKanbanRendererRecord[] => compact(renderers.map(toKanbanRendererRecord));

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
      const handlers = renderer.contribution as {
        queryHandlerId?: string;
        valueChangeHandlerId?: string;
        applyHandlerId?: string;
        resetHandlerId?: string;
      };
      if (!handlers.queryHandlerId) return null;

      const refreshEventIds = compact(renderer.contribution.refreshEvents?.map(refIdOf) ?? []);

      return {
        id: renderer.id,
        extensionId: renderer.extensionId,
        title: renderer.contribution.title,
        queryHandlerId: handlers.queryHandlerId,
        valueChangeHandlerId: handlers.valueChangeHandlerId,
        applyHandlerId: handlers.applyHandlerId,
        resetHandlerId: handlers.resetHandlerId,
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
      const handlers = renderer.contribution as {
        bodyHandlerId?: string;
        childrenHandlerId?: string;
        footerHandlerId?: string;
      };
      if (!handlers.bodyHandlerId) return null;
      return {
        id: renderer.id,
        extensionId: renderer.extensionId,
        title: renderer.contribution.title,
        icon: renderer.contribution.icon,
        bodyHandlerId: handlers.bodyHandlerId,
        childrenHandlerId: handlers.childrenHandlerId,
        footerHandlerId: handlers.footerHandlerId,
        defaultExpandedSectionIds: renderer.contribution.defaultExpandedSectionIds,
        defaultExpandedNodeIds: renderer.contribution.defaultExpandedNodeIds,
      };
    }),
  );

export const toCheckFileRenderers = (renderers: ExtensionRuntime["fileRenderers"]) =>
  compact(
    renderers.map((renderer) => {
      const handlers = renderer.contribution as { loadHandlerId?: string; saveHandlerId?: string };
      if (!handlers.loadHandlerId) return null;
      return {
        id: renderer.id,
        extensionId: renderer.extensionId,
        title: renderer.contribution.title,
        icon: renderer.contribution.icon,
        resourceKind: renderer.contribution.resourceKind,
        loadHandlerId: handlers.loadHandlerId,
        saveHandlerId: handlers.saveHandlerId,
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
