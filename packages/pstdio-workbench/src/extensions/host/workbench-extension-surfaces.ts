import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import type { Disposable, PreferencePropertySchema, PreferenceScope, PreferenceValue } from "../../core";
import { WorkflowStatusSettings } from "../../react/statuses/workflow-status-settings";
import {
  BRIDGE_WEBVIEW_RENDERER_ID,
  type CreateBridgeWebviewHostCapabilities,
  createBridgeWebviewRenderer,
  getBridgeWebviewHostEventPublisher,
  renderBridgeWebviewFrame,
} from "../bridge/bridge-webview-renderer";
import { createExtensionWebviewHostCapabilities } from "../bridge/webview-command-capabilities";
import { toBridgeWebviewConfig } from "../bridge/webview-contribution-config";
import {
  panelMenuDeclarationOffsets,
  registerWorkbenchExtensionPanel,
  resolveWorkbenchExtensionViewInput,
  toWorkbenchCompositionPanelContribution,
} from "../contributions/panel-contributions";
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
      files: input.webviewFiles,
      projectId: input.projectId,
      slotKind,
    });

  return withHostCapabilityOverrides(createBase, input.createWebviewHostCapabilityOverrides);
};

export const registerBridgeRenderer = (input: InternalRegisterWorkbenchExtensionContributionsInput) => {
  if (input.workbench.renderers.getRenderer(BRIDGE_WEBVIEW_RENDERER_ID)) return [] as Disposable[];
  return [
    input.workbench.renderers.registerRenderer(
      createBridgeWebviewRenderer({
        createHostCapabilities: createExtensionHostCapabilities(input, "panel"),
        createProps: input.createWebviewProps,
        createTheme: input.createWebviewTheme,
      }),
    ),
  ];
};

export const registerWebviewPanels = (input: InternalRegisterWorkbenchExtensionContributionsInput) => {
  const menuOffsets = panelMenuDeclarationOffsets(input.metadata.panels);
  return input.metadata.panels.flatMap((panel, index) => {
    if (!panel.webview) return [];
    return [
      registerWorkbenchExtensionPanel({
        workbench: input.workbench,
        path: panel.path,
        aliases: panel.aliases,
        resolveInput: resolveWorkbenchExtensionViewInput(input.resolveViewInput, panel),
        contribution: toWorkbenchCompositionPanelContribution({
          panel,
          rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
          declarationIndex: index,
          menuDeclarationOffset: menuOffsets[index]!,
          resourcePanels: input.metadata.resourcePanels,
          config: toBridgeWebviewConfig(panel.webview),
        }),
      }),
    ];
  });
};

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
    input.workbench.settings.registerPanel({
      id: "workbench.statuses",
      title: "Statuses",
      icon: "list-checks",
      kind: "custom",
      order: statusesSettingsOrder,
      section: input.settingsSectionId ?? settingsSectionIdDefault,
      scope: "project",
      render: () => createElement(WorkflowStatusSettings, { workbench: input.workbench }),
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
        kind: "custom",
        order: extensionSettingsOrderBase + index,
        section: panel.section ?? sectionId,
        scope: panel.scope,
        render: (renderInput) =>
          renderBridgeWebviewFrame({
            context: {
              workbench: renderInput.workbench,
              webviewId: panel.id,
              placement: { ...renderInput.instance, panelId: panel.id },
              hostEvents: getBridgeWebviewHostEventPublisher(renderInput.workbench, renderInput.instance),
            },
            createHostCapabilities: createExtensionHostCapabilities(input, "settings"),
            createProps: input.createWebviewProps ?? (({ placement }) => ({ placement, resource: placement.resource })),
            createTheme: input.createWebviewTheme,
            ownerId: panel.extensionId,
            title: text(panel.title, panel.id),
            webview: toBridgeWebviewConfig(panel.webview),
          }),
      }),
    );
  }

  return disposables;
};
