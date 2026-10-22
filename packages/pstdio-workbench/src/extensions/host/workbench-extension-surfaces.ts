import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, PreferencePropertySchema, PreferenceScope, PreferenceValue } from "../../core";
import {
  type CreateBridgeWebviewHostAdapters,
  getBridgeWebviewHostEventPublisher,
  renderBridgeWebviewFrame,
} from "../bridge/bridge-webview-renderer";
import { createWorkbenchExtensionWebviewAdapters } from "../bridge/webview-command-capabilities";
import { toBridgeWebviewConfig } from "../bridge/webview-contribution-config";
import type { InternalRegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

const settingsSectionIdDefault = "extensions";
const extensionSettingsOrderBase = 1_000;

const asPreferenceValue = (value: unknown): PreferenceValue | undefined =>
  value === undefined ? undefined : (value as PreferenceValue);

const preferenceScope = (scope: "global" | "project" | "device"): PreferenceScope =>
  scope === "project" ? "project" : "user";

const createExtensionHostAdapters = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  slotKind: NonNullable<CommandExecuteRequest["slot"]>["kind"],
): CreateBridgeWebviewHostAdapters => {
  const createBase = createWorkbenchExtensionWebviewAdapters({
    artifacts: input.webviewArtifacts,
    executeCommand: input.executeCommand,
    extensionIdForWebview: (webviewId) => input.metadata.panels.find((panel) => panel.id === webviewId)?.extensionId,
    files: input.webviewFiles,
    projectId: input.projectId,
    slotKind,
  });
  return (context) => ({ ...createBase(context), ...input.createWebviewHostAdapters?.(context) });
};

export const registerWebviewPanels = (input: InternalRegisterWorkbenchExtensionContributionsInput) => {
  return input.metadata.panels.flatMap((panel) => {
    if (!panel.webview) return [];
    const webview = toBridgeWebviewConfig(panel.webview);
    return [
      input.workbench.views.registerView({
        id: panel.id,
        title: text(panel.title, panel.id),
        icon: panel.icon,
        body: {
          kind: "react",
          render: (renderInput) => {
            const embedded = input.metadata.settingsPanels.some(
              (settingsPanel) => settingsPanel.id === renderInput.instance.panelId && settingsPanel.parentPanelId,
            );
            let sizing: "content-width" | "content-height" | undefined;
            if (renderInput.panel.region === "status") sizing = "content-width";
            if (embedded) sizing = "content-height";
            const slotKind = input.metadata.settingsPanels.some(
              (settingsPanel) => settingsPanel.id === renderInput.instance.panelId && settingsPanel.viewId === panel.id,
            )
              ? "settings"
              : "panel";
            return (
              input.renderWebview?.(renderInput) ??
              renderBridgeWebviewFrame({
                sizing,
                context: {
                  workbench: renderInput.workbench,
                  webviewId: panel.id,
                  placement: renderInput.instance,
                  hostEvents: getBridgeWebviewHostEventPublisher(renderInput.workbench, renderInput.instance),
                },
                createHostAdapters: createExtensionHostAdapters(input, slotKind),
                createProps:
                  input.createWebviewProps ?? (({ placement }) => ({ placement, resource: placement.resource })),
                createTheme: input.createWebviewTheme,
                ownerId: panel.extensionId,
                title: text(panel.title, panel.id),
                webview,
              })
            );
          },
        },
      }),
    ];
  });
};

const viewMenuPlacementPriority = { first: 1_000_000, default: 0, last: -1_000_000 } as const;

export const registerViewMenus = (input: InternalRegisterWorkbenchExtensionContributionsInput) =>
  input.metadata.panels
    .flatMap((panel) => panel.panelMenus ?? [])
    .map((menu, index) =>
      input.workbench.viewMenus.registerViewMenu({
        id: menu.id,
        ownerViewId: menu.ownerPanelId,
        viewId: menu.viewId,
        side: menu.side,
        priority: viewMenuPlacementPriority[menu.placement ?? "default"] - index,
      }),
    );

export const registerSettings = (input: InternalRegisterWorkbenchExtensionContributionsInput) => {
  const disposables: Disposable[] = [];
  const sectionId = input.settingsSectionId ?? settingsSectionIdDefault;

  if (!input.workbench.settings.getSection(sectionId)) {
    disposables.push(
      input.workbench.settings.registerSection({ id: sectionId, title: input.settingsSectionTitle ?? "Extensions" }),
    );
  }

  const sections = [...input.metadata.settingsSections].sort(
    (left, right) =>
      (left.order ?? 0) - (right.order ?? 0) ||
      left.extensionId.localeCompare(right.extensionId) ||
      left.id.localeCompare(right.id),
  );
  for (const section of sections) {
    disposables.push(
      input.workbench.settings.registerSection({
        id: section.id,
        title: text(section.title, section.id),
        order: section.order,
        scope: section.scope,
      }),
    );
  }

  // Keep the existing last-definition-wins rule for shared legacy names.
  const definitions = new Map(input.metadata.settingsDefinitions.map((setting) => [setting.key, setting]));
  const propertiesByOwner = new Map<string, Record<string, PreferencePropertySchema>>();
  for (const setting of definitions.values()) {
    const properties = propertiesByOwner.get(setting.extensionId) ?? Object.create(null);
    properties[setting.key] = {
      type: setting.type,
      scope: preferenceScope(setting.scope),
      default: asPreferenceValue(setting.default),
      enum: setting.enum as PreferenceValue[] | undefined,
      description: text(setting.description),
    } satisfies PreferencePropertySchema;
    propertiesByOwner.set(setting.extensionId, properties);
  }
  for (const [ownerId, properties] of propertiesByOwner) {
    disposables.push(input.workbench.preferences.registerSchema({ properties }, { ownerId }));
  }

  const panels = [...input.metadata.settingsPanels].sort(
    (left, right) => left.extensionId.localeCompare(right.extensionId) || left.id.localeCompare(right.id),
  );
  for (const [index, panel] of panels.entries()) {
    if (panel.slotId === "extension.settings") continue;
    disposables.push(
      input.workbench.settings.registerPanel({
        id: panel.id,
        title: text(panel.title, panel.id),
        icon: panel.icon,
        kind: "view",
        order: extensionSettingsOrderBase + index,
        section: panel.section ?? sectionId,
        scope: panel.scope,
        parentPanelId: panel.parentPanelId,
        viewId: panel.viewId,
      }),
    );
  }

  return disposables;
};
