import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { matchesResourceWhen } from "@pstdio/sdk/extensions";
import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { text } from "pstdio-extensions/workbench";
import type {
  Disposable,
  PreferencePropertySchema,
  PreferenceScope,
  PreferenceValue,
  WorkbenchCommandExecutionContext,
  WorkbenchModeActivationContext,
  WorkbenchModuleContributionContext,
} from "../../core";
import { workbenchCommandPaletteMenuPath } from "../../core";
import {
  BRIDGE_WEBVIEW_RENDERER_ID,
  type CreateBridgeWebviewHostCapabilities,
  type CreateBridgeWebviewProps,
  type CreateBridgeWebviewTheme,
  createBridgeWebviewRenderer,
  getBridgeWebviewHostEventPublisher,
  renderBridgeWebviewFrame,
} from "../bridge/bridge-webview-renderer";
import {
  createExtensionWebviewHostCapabilities,
  type ExtensionWebviewFileCapabilities,
} from "../bridge/webview-command-capabilities";
import { toBridgeWebviewConfig } from "../bridge/webview-contribution-config";
import { registerWorkbenchExtensionCommandPaletteResources } from "../contributions/command-palette-resource-contributions";
import { registerWorkbenchExtensionDataRenderers } from "../contributions/data-renderer-contributions";
import { registerWorkbenchExtensionDataTableRenderers } from "../contributions/data-table-renderer-contributions";
import {
  buildWorkbenchExtensionCommandPaletteRegistrations,
  buildWorkbenchExtensionMenuRegistrations,
  type WorkbenchExtensionMenuSlotConfig,
  type WorkbenchExtensionMenuWhenBuilder,
} from "../contributions/extension-contributions";
import { registerWorkbenchExtensionFileRenderers } from "../contributions/file-renderer-contributions";
import { registerWorkbenchExtensionRoutes, routeResource } from "../contributions/route-contributions";
import { registerWorkbenchExtensionTreeItems } from "../contributions/tree-item-contributions";
import { registerWorkbenchExtensionTreeRenderers } from "../contributions/tree-renderer-contributions";
import { resolveWorkbenchModeArea, resolveWorkbenchViewArea } from "../shared/workbench-targets";
import {
  createExtensionSlot,
  executeWorkbenchExtensionCommand,
  type WorkbenchExtensionCommandContext,
} from "./workbench-extension-command";

export interface RegisterWorkbenchExtensionContributionsInput {
  createMenuWhenExpression?: WorkbenchExtensionMenuWhenBuilder;
  createWebviewHostCapabilities?: CreateBridgeWebviewHostCapabilities;
  createWebviewHostCapabilityOverrides?: CreateBridgeWebviewHostCapabilities;
  createWebviewProps?: CreateBridgeWebviewProps;
  createWebviewTheme?: CreateBridgeWebviewTheme;
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
  menuSlotsById?: ReadonlyMap<string, WorkbenchExtensionMenuSlotConfig>;
  menuTargetsById?: ReadonlyMap<string, WorkbenchExtensionMenuSlotConfig>;
  metadata: WorkbenchExtensionMetadata;
  openHref?: (href: string) => unknown;
  projectId: string;
  routeResourceKind?: string;
  settingsSectionId?: string;
  settingsSectionTitle?: string;
  webviewFiles?: ExtensionWebviewFileCapabilities;
  workbench: WorkbenchModuleContributionContext;
}

const routeResourceKindDefault = "extension-route";
const settingsSectionIdDefault = "extensions";

const disposeAll = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
};

const asParams = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

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
  input: RegisterWorkbenchExtensionContributionsInput,
  slotKind: NonNullable<CommandExecuteRequest["slot"]>["kind"],
) => {
  const createBase =
    input.createWebviewHostCapabilities ??
    createExtensionWebviewHostCapabilities({
      executeCommand: input.executeCommand,
      files: input.webviewFiles,
      projectId: input.projectId,
      slotKind,
    });

  return withHostCapabilityOverrides(createBase, input.createWebviewHostCapabilityOverrides);
};

const registerBridgeRenderer = (input: RegisterWorkbenchExtensionContributionsInput, disposables: Disposable[]) => {
  if (input.workbench.renderers.getRenderer(BRIDGE_WEBVIEW_RENDERER_ID)) return;

  disposables.push(
    input.workbench.renderers.registerRenderer(
      createBridgeWebviewRenderer({
        createHostCapabilities: createExtensionHostCapabilities(input, "view"),
        createProps: input.createWebviewProps,
        createTheme: input.createWebviewTheme,
      }),
    ),
  );
};

const registerCommands = (context: WorkbenchExtensionCommandContext, metadata: WorkbenchExtensionMetadata) =>
  metadata.commands.map((command) =>
    context.workbench.commands.registerCommand(
      {
        id: command.id,
        label: text(command.title, command.id),
        description: text(command.description),
        params: command.params,
      },
      {
        execute: (args, executionContext) =>
          executeWorkbenchExtensionCommand(context, command.id, {
            params: asParams(args),
            resource: executionContext?.resource,
          }),
      },
    ),
  );

const menuCommandResource = (
  input: RegisterWorkbenchExtensionContributionsInput,
  executionContext: WorkbenchCommandExecutionContext | undefined,
) => executionContext?.resource ?? input.workbench.getPrimaryResource();

const registerMenus = (
  input: RegisterWorkbenchExtensionContributionsInput,
  context: WorkbenchExtensionCommandContext,
) => {
  if (!input.menuSlotsById) return [] as Disposable[];
  const registrations = buildWorkbenchExtensionMenuRegistrations({
    metadata: input.metadata,
    menuSlotsById: input.menuSlotsById,
    menuTargetsById: input.menuTargetsById,
    createWhenExpression: input.createMenuWhenExpression,
  });

  return registrations.flatMap((registration) => [
    input.workbench.commands.registerCommand(registration.command, {
      execute: (args, executionContext) =>
        executeWorkbenchExtensionCommand(context, registration.targetCommandId, {
          params: { ...(registration.contribution.params ?? {}), ...(asParams(args) ?? {}) },
          resource: menuCommandResource(input, executionContext),
          slot: createExtensionSlot({
            id: registration.contribution.slotId,
            kind: "menu",
            projectId: input.projectId,
            context: { contributionId: registration.contribution.id },
          }),
        }),
    }),
    input.workbench.layout.registerMenuItem(registration.menuPath, registration.menuItem),
  ]);
};

const registerCommandPaletteContributions = (
  input: RegisterWorkbenchExtensionContributionsInput,
  context: WorkbenchExtensionCommandContext,
) => {
  const registrations = buildWorkbenchExtensionCommandPaletteRegistrations({ metadata: input.metadata });

  return registrations.flatMap((registration) => [
    input.workbench.commands.registerCommand(registration.command, {
      execute: (args, executionContext) =>
        executeWorkbenchExtensionCommand(context, registration.targetCommandId, {
          params: { ...(registration.contribution.params ?? {}), ...(asParams(args) ?? {}) },
          resource: menuCommandResource(input, executionContext),
          slot: createExtensionSlot({
            id: "workbench.commandPalette",
            kind: "menu",
            projectId: input.projectId,
            context: { contributionId: registration.contribution.id },
          }),
        }),
      isVisible: () => matchesResourceWhen(registration.contribution.when, input.workbench.getPrimaryResource()?.kind),
    }),
    input.workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, registration.menuItem),
  ]);
};

const registerWebviewViews = (input: RegisterWorkbenchExtensionContributionsInput) =>
  input.metadata.views.flatMap((view) => {
    if (!view.webview) return [];
    return [
      input.workbench.layout.registerWidget({
        id: view.id,
        title: text(view.title, view.id),
        area: view.surface === "modal" ? "overlay" : resolveWorkbenchViewArea(view.target),
        rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
        singleton: true,
        resourceKinds: view.resourceKind ? [view.resourceKind] : undefined,
        config: {
          ...toBridgeWebviewConfig(view.webview),
          ...(view.surface === "modal"
            ? { size: "lg", scrollBehavior: "inside", contentHeight: "min(560px, calc(100dvh - 48px))" }
            : {}),
        },
      }),
    ];
  });

const registerSettings = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const disposables: Disposable[] = [];
  const sectionId = input.settingsSectionId ?? settingsSectionIdDefault;
  if (!input.workbench.settings.getSection(sectionId)) {
    disposables.push(
      input.workbench.settings.registerSection({ id: sectionId, title: input.settingsSectionTitle ?? "Extensions" }),
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

  for (const panel of input.metadata.settingsPanels) {
    disposables.push(
      input.workbench.settings.registerPanel({
        id: panel.id,
        title: text(panel.title, panel.id),
        kind: "custom",
        section: sectionId,
        scope: panel.scope,
        render: (renderInput) =>
          renderBridgeWebviewFrame({
            context: {
              workbench: renderInput.workbench,
              webviewId: panel.id,
              placement: { ...renderInput.placement, contributionId: panel.id },
              hostEvents: getBridgeWebviewHostEventPublisher(renderInput.workbench, renderInput.placement),
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

const registerResourceOpeners = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const resourceKinds = new Set<string>();
  for (const view of input.metadata.views) if (view.resourceKind) resourceKinds.add(view.resourceKind);
  for (const renderer of input.metadata.dataRenderers ?? [])
    if (renderer.resourceKind) resourceKinds.add(renderer.resourceKind);

  const disposables: Disposable[] = [];
  for (const kind of resourceKinds) {
    if (!input.workbench.resources.getKind(kind)) {
      disposables.push(
        input.workbench.resources.registerKind({ kind, label: kind, icon: "FileText", surface: "primary" }),
      );
    }
    disposables.push(
      input.workbench.resources.registerOpener({
        id: `workbench.extension.resource.${kind}`,
        canOpen: (resource) => resource.kind === kind,
        open: (resource) => {
          const views = input.metadata.views.filter((view) => view.resourceKind === kind && view.surface !== "modal");
          return views.map((view) =>
            input.workbench.layout.openWidget(view.id, {
              resource,
              title: resource.label ?? resource.id ?? resource.uri,
            }),
          );
        },
      }),
    );
  }
  return disposables;
};

type WorkbenchExtensionModeRecord = WorkbenchExtensionMetadata["modes"][number];
type WorkbenchExtensionModeLayout = NonNullable<WorkbenchExtensionModeRecord["layout"]>;
type WorkbenchExtensionModeOpenEntry = NonNullable<WorkbenchExtensionModeLayout["open"]>[number];

const resetModeLayout = (
  ctx: WorkbenchModeActivationContext,
  reset: WorkbenchExtensionModeLayout["reset"] | undefined,
) => {
  if (reset === true) {
    ctx.layout.resetAreas();
    return;
  }

  if (!Array.isArray(reset)) return;
  for (const target of reset) ctx.layout.clearArea(resolveWorkbenchModeArea(target));
};

const openModeView = (ctx: WorkbenchModeActivationContext, entry: WorkbenchExtensionModeOpenEntry) => {
  if (!entry.view) return;
  ctx.layout.openWidget(entry.view, {
    area: resolveWorkbenchModeArea(entry.target),
    pinned: entry.pinned,
    title: text(entry.title),
  });
};

const openModeResource = (
  input: RegisterWorkbenchExtensionContributionsInput,
  ctx: WorkbenchModeActivationContext,
  entry: WorkbenchExtensionModeOpenEntry,
) => {
  if (!entry.resource) return;
  const route = input.metadata.routes.find(
    (candidate) => candidate.id === entry.resource || candidate.path === entry.resource,
  );
  if (!route) return;
  void ctx.resources.openResource(routeResource(route, input.routeResourceKind ?? routeResourceKindDefault));
};

const activateModeLayout = (
  input: RegisterWorkbenchExtensionContributionsInput,
  ctx: WorkbenchModeActivationContext,
  mode: WorkbenchExtensionModeRecord,
) => {
  resetModeLayout(ctx, mode.layout?.reset);
  for (const entry of mode.layout?.open ?? []) {
    openModeView(ctx, entry);
    openModeResource(input, ctx, entry);
  }
};

const registerModes = (input: RegisterWorkbenchExtensionContributionsInput) =>
  input.metadata.modes.map((mode) =>
    input.workbench.modes.registerMode({
      id: mode.modeId,
      label: text(mode.label, mode.modeId),
      activate: (ctx) => {
        activateModeLayout(input, ctx, mode);
        return undefined;
      },
    }),
  );

export const registerWorkbenchExtensionContributions = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const disposables: Disposable[] = [];
  const context: WorkbenchExtensionCommandContext = input;

  registerBridgeRenderer(input, disposables);
  disposables.push(...registerCommands(context, input.metadata));
  disposables.push(...registerMenus(input, context));
  disposables.push(...registerCommandPaletteContributions(input, context));
  disposables.push(registerWorkbenchExtensionTreeRenderers(input));
  disposables.push(registerWorkbenchExtensionFileRenderers(input));
  disposables.push(...registerWebviewViews(input));
  disposables.push(registerWorkbenchExtensionDataRenderers(context, input.metadata.dataRenderers ?? []));
  disposables.push(
    registerWorkbenchExtensionDataTableRenderers(
      context,
      input.metadata.dataTableRenderers ?? [],
      input.metadata.views,
    ),
  );
  disposables.push(
    registerWorkbenchExtensionCommandPaletteResources(context, input.metadata.commandPaletteResources ?? []),
  );
  disposables.push(...registerSettings(input));
  disposables.push(
    ...registerWorkbenchExtensionRoutes({
      metadata: input.metadata,
      routeResourceKind: input.routeResourceKind ?? routeResourceKindDefault,
      workbench: input.workbench,
    }),
  );
  disposables.push(
    ...registerWorkbenchExtensionTreeItems({
      metadata: input.metadata,
      openHref: input.openHref,
      routeResourceKind: input.routeResourceKind ?? routeResourceKindDefault,
      workbench: input.workbench,
    }),
  );
  disposables.push(...registerResourceOpeners(input));
  disposables.push(...registerModes(input));

  return {
    dispose() {
      disposeAll(disposables);
    },
  };
};
