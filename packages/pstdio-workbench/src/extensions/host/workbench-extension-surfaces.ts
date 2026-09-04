import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import type { Disposable, PreferencePropertySchema, PreferenceScope, PreferenceValue } from "../../core";
import { WorkflowStatusSettings } from "../../react/statuses/workflow-status-settings";
import {
  type CreateBridgeWebviewHostCapabilities,
  getBridgeWebviewHostEventPublisher,
  renderBridgeWebviewFrame,
} from "../bridge/bridge-webview-renderer";
import { createExtensionWebviewHostCapabilities } from "../bridge/webview-command-capabilities";
import { toBridgeWebviewConfig } from "../bridge/webview-contribution-config";
import { executeWorkbenchExtensionCommand, type WorkbenchExtensionCommandContext } from "./workbench-extension-command";
import type { InternalRegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

const settingsSectionIdDefault = "extensions";
const extensionSettingsOrderBase = 1_000;
const statusesSettingsOrder = 25;

const asPreferenceValue = (value: unknown): PreferenceValue | undefined =>
  value === undefined ? undefined : (value as PreferenceValue);

const preferenceScope = (scope: "global" | "project"): PreferenceScope => (scope === "global" ? "user" : "project");

const withHostCapabilityOverrides = (
  createBase: CreateBridgeWebviewHostCapabilities,
  createOverrides: CreateBridgeWebviewHostCapabilities | undefined,
): CreateBridgeWebviewHostCapabilities => {
  if (!createOverrides) return createBase;
  return (context) =>
    ({
      ...createBase(context),
      ...createOverrides(context),
    }) satisfies HostCapabilityRegistry;
};

const createExtensionHostCapabilities = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  slotKind: NonNullable<CommandExecuteRequest["slot"]>["kind"],
) => {
  const createBase =
    input.createWebviewHostCapabilities ??
    createExtensionWebviewHostCapabilities({
      artifacts: input.webviewArtifacts,
      executeCommand: input.executeCommand,
      extensionIdForWebview: (webviewId) => input.metadata.panels.find((panel) => panel.id === webviewId)?.extensionId,
      files: input.webviewFiles,
      projectId: input.projectId,
      slotKind,
    });

  return withHostCapabilityOverrides(createBase, input.createWebviewHostCapabilityOverrides);
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
            const slotKind = input.metadata.settingsPanels.some(
              (settingsPanel) => settingsPanel.id === renderInput.instance.panelId && settingsPanel.viewId === panel.id,
            )
              ? "settings"
              : "panel";
            return (
              input.renderWebview?.(renderInput) ??
              renderBridgeWebviewFrame({
                context: {
                  workbench: renderInput.workbench,
                  webviewId: panel.id,
                  placement: renderInput.instance,
                  hostEvents: getBridgeWebviewHostEventPublisher(renderInput.workbench, renderInput.instance),
                },
                createHostCapabilities: createExtensionHostCapabilities(input, slotKind),
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

const statusResult = (value: unknown) => {
  if (!value || typeof value !== "object" || !("statuses" in value) || !Array.isArray(value.statuses)) {
    throw new Error("Status provider returned an invalid response");
  }
  return value.statuses;
};

export const registerStatuses = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  context: WorkbenchExtensionCommandContext,
) => {
  const records = input.metadata.statuses ?? [];
  if (records.length === 0) return [] as Disposable[];
  const settingsViewId = "workbench.extension-statuses.settings";
  const disposables = records.map((record, index) =>
    input.workbench.statuses.registerStatusSet(
      {
        id: record.id,
        title: text(record.title, record.id),
        actions: record.actions?.map((action) => ({
          id: action.id,
          label: text(action.label, action.id),
          icon: action.icon,
        })),
        query: async () =>
          statusResult(await executeWorkbenchExtensionCommand(context, record.queryHandlerId, { params: {} })) as never,
        save: record.saveHandlerId
          ? async (statuses) =>
              statusResult(
                await executeWorkbenchExtensionCommand(context, record.saveHandlerId!, { params: { statuses } }),
              ) as never
          : undefined,
      },
      { ownerId: record.extensionId, priority: -index },
    ),
  );
  disposables.push(
    input.workbench.views.registerView({
      id: settingsViewId,
      title: "Statuses",
      body: {
        kind: "react",
        render: () => createElement(WorkflowStatusSettings, { workbench: input.workbench }),
      },
    }),
  );
  disposables.push(
    input.workbench.settings.registerPanel({
      id: "workbench.statuses",
      title: "Statuses",
      icon: "list-checks",
      kind: "view",
      order: statusesSettingsOrder,
      section: input.settingsSectionId ?? settingsSectionIdDefault,
      scope: "project",
      viewId: settingsViewId,
    }),
  );
  return disposables;
};

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

  const properties = Object.fromEntries(
    (input.metadata.settingsDefinitions ?? []).map((setting) => [
      setting.key,
      {
        type: setting.type,
        scope: preferenceScope(setting.scope),
        default: asPreferenceValue(setting.default),
        enum: setting.enum as PreferenceValue[] | undefined,
        description: text(setting.description),
      } satisfies PreferencePropertySchema,
    ]),
  );
  if (Object.keys(properties).length > 0) disposables.push(input.workbench.preferences.registerSchema({ properties }));

  const panels = [...input.metadata.settingsPanels].sort(
    (left, right) => left.extensionId.localeCompare(right.extensionId) || left.id.localeCompare(right.id),
  );
  for (const [index, panel] of panels.entries()) {
    disposables.push(
      input.workbench.settings.registerPanel({
        id: panel.id,
        title: text(panel.title, panel.id),
        icon: panel.icon,
        kind: "view",
        order: extensionSettingsOrderBase + index,
        section: panel.section ?? sectionId,
        scope: panel.scope,
        viewId: panel.viewId,
      }),
    );
  }

  return disposables;
};
