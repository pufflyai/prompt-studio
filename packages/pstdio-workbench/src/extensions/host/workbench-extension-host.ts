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
  WorkbenchModuleContext,
  WorkbenchPanelRegion,
} from "../../core";
import { workbenchCommandPaletteMenuPath, workbenchPanelRegions } from "../../core";
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
import {
  createWorkbenchCompositionRegistry,
  listCompositionAddablePanels,
  reconcileCompositionLayout,
  type WorkbenchCompositionRegistry,
} from "../contributions/composition-contributions";
import { registerWorkbenchExtensionDataTableRenderers } from "../contributions/data-table-renderer-contributions";
import {
  buildWorkbenchExtensionCommandPaletteRegistrations,
  buildWorkbenchExtensionMenuRegistrations,
  type WorkbenchExtensionMenuSlotConfig,
  type WorkbenchExtensionMenuWhenBuilder,
} from "../contributions/extension-contributions";
import { registerWorkbenchExtensionFileRenderers } from "../contributions/file-renderer-contributions";
import { registerWorkbenchExtensionKanbanRenderers } from "../contributions/kanban-renderer-contributions";
import {
  panelMenuDeclarationOffsets,
  registerWorkbenchExtensionPanel,
  toWorkbenchCompositionPanelContribution,
} from "../contributions/panel-contributions";
import { registerWorkbenchExtensionRoutes } from "../contributions/route-contributions";
import { registerWorkbenchExtensionTreeItems } from "../contributions/tree-item-contributions";
import { registerWorkbenchExtensionTreeRenderers } from "../contributions/tree-renderer-contributions";
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
  workbench: WorkbenchModuleContext;
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
        createHostCapabilities: createExtensionHostCapabilities(input, "panel"),
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
            context: { panelId: registration.contribution.id },
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
            context: { panelId: registration.contribution.id },
          }),
        }),
      isVisible: () => matchesResourceWhen(registration.contribution.when, input.workbench.getPrimaryResource()?.kind),
    }),
    input.workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, registration.menuItem),
  ]);
};

const registerWebviewPanels = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const menuOffsets = panelMenuDeclarationOffsets(input.metadata.panels);
  return input.metadata.panels.flatMap((panel, index) => {
    if (!panel.webview) return [];
    return [
      registerWorkbenchExtensionPanel({
        workbench: input.workbench,
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

// Status items are chrome contributions: the host renders them in the status
// surface and keeps them out of docked layout and persistence. A `when.mode`
// expression scopes the item to its modes.
const registerStatusItems = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const disposables: Disposable[] = [];
  for (const [index, item] of (input.metadata.statusItems ?? []).entries()) {
    if (!item.webview) continue;
    disposables.push(
      input.workbench.layout.registerWidget({
        id: item.id,
        title: text(item.title, item.id),
        region: "status",
        rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
        closable: false,
        priority: -index,
        config: toBridgeWebviewConfig(item.webview),
      }),
    );
    const matchesMode = () => {
      const modes = item.when?.mode;
      if (!modes) return true;
      const active = input.workbench.modes.getActiveModeId() ?? "";
      return Array.isArray(modes) ? modes.includes(active) : modes === active;
    };
    const sync = () => {
      const placed = input.workbench.layout
        .getLayout()
        .regions.status.widgets.find((placement) => placement.contributionId === item.id);
      if (matchesMode() && !placed) input.workbench.layout.openWidget(item.id, { region: "status" });
      else if (!matchesMode() && placed) input.workbench.layout.removeWidgetPlacement(placed.widgetId);
    };
    sync();
    disposables.push(input.workbench.modes.onDidChangeActive(sync));
  }
  return disposables;
};

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

const registerResourcePresenters = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const kindRecords = new Map<
    string,
    { surface: "primary" | "secondary" | "attached"; label?: string; icon?: string }
  >();
  for (const kind of input.metadata.resourceKinds ?? []) {
    kindRecords.set(kind.id, {
      surface: kind.surface,
      label: kind.label ? text(kind.label, kind.id) : undefined,
      icon: kind.icon,
    });
  }
  for (const renderer of input.metadata.kanbanRenderers ?? []) {
    if (renderer.resourceKind && !kindRecords.has(renderer.resourceKind)) {
      kindRecords.set(renderer.resourceKind, { surface: "primary" });
    }
  }

  const edges = input.metadata.resourcePanels ?? [];
  const disposables: Disposable[] = [];
  for (const [kind, record] of kindRecords) {
    if (!input.workbench.resources.getKind(kind)) {
      disposables.push(
        input.workbench.resources.registerKind({
          kind,
          label: record.label ?? kind,
          icon: record.icon ?? "FileText",
          surface: record.surface,
        }),
      );
    }
    const kindEdges = edges.filter((edge) => edge.resourceKind === kind);
    const panels = kindEdges
      .map((edge) => ({ edge, panel: input.metadata.panels.find((candidate) => candidate.id === edge.panel) }))
      .filter((entry): entry is { edge: (typeof kindEdges)[number]; panel: (typeof input.metadata.panels)[number] } =>
        Boolean(entry.panel),
      );
    if (panels.length > 0) {
      disposables.push(
        input.workbench.resources.registerPresenter({
          id: `workbench.extension.resource.${kind}`,
          canOpen: (resource) => resource.kind === kind,
          open: (resource) => {
            // Reuse a placement where the composition resolver (or the user) put
            // it; only unplaced panels fall back to their default region.
            const placedRegion = (panelId: string) => {
              const layout = input.workbench.layout.getLayout();
              const dockedRegions = ["sidenav", "main", "secondary", "side"] as const;
              return dockedRegions.find((region) =>
                layout.regions[region].widgets.some((placement) => placement.contributionId === panelId),
              );
            };
            const instances = panels.map(({ panel }) =>
              input.workbench.layout.openPanel(panel.id, {
                region: placedRegion(panel.id),
                resource,
                title: resource.label ?? resource.id ?? resource.uri,
                strategy: { kind: "persistent" },
              }),
            );
            const primaryIndex = panels.findIndex(({ edge }) => edge.slot === "primary");
            return instances[primaryIndex >= 0 ? primaryIndex : 0]!;
          },
        }),
      );
    }
  }
  return disposables;
};

type WorkbenchExtensionModeRecord = WorkbenchExtensionMetadata["modes"][number];

// Registers the metadata composition (resource kinds, panel capabilities,
// resource-panel edges, and mode recipes) so the composition resolver can place
// panels per active mode-resource context.
const registerComposition = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const registry = createWorkbenchCompositionRegistry();
  const disposables: Disposable[] = [];
  for (const kind of input.metadata.resourceKinds ?? []) {
    disposables.push(
      registry.registerResourceKind({
        id: kind.id,
        extensionId: kind.extensionId,
        surface: kind.surface,
        slots: kind.slots,
      }),
    );
  }
  for (const panel of input.metadata.panels) {
    disposables.push(
      registry.registerPanelCapability({
        id: panel.id,
        extensionId: panel.extensionId,
        title: text(panel.title, panel.id),
        icon: panel.icon,
        supportedRegions: panel.supportedRegions,
      }),
    );
  }
  for (const edge of input.metadata.resourcePanels ?? []) {
    disposables.push(
      registry.registerResourcePanel({
        id: edge.id,
        extensionId: edge.extensionId,
        resourceKind: edge.resourceKind,
        panel: edge.panel,
        slot: edge.slot,
      }),
    );
  }
  for (const mode of input.metadata.modes) {
    disposables.push(
      registry.registerModeComposition({
        id: mode.modeId,
        resources: mode.resources,
        modePanels: mode.modePanels,
      }),
    );
  }
  return { registry, disposables };
};

const extensionResourceUri = (type: string, id: string) =>
  `pstdio://extension-resource/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;

const toModeDefaultResource = (
  input: RegisterWorkbenchExtensionContributionsInput,
  defaultResource: WorkbenchExtensionModeRecord["defaultResource"],
) => {
  if (!defaultResource) return undefined;
  if ("commandId" in defaultResource) {
    return async () => {
      const result = (await input.executeCommand(defaultResource.commandId, { projectId: input.projectId })) as
        | { type?: string; id?: string; label?: string }
        | undefined;
      if (!result || typeof result.type !== "string" || typeof result.id !== "string") return undefined;
      return {
        kind: result.type,
        uri: extensionResourceUri(result.type, result.id),
        id: result.id,
        label: result.label,
      };
    };
  }
  return {
    kind: defaultResource.type,
    uri: extensionResourceUri(defaultResource.type, defaultResource.id),
    id: defaultResource.id,
    label: defaultResource.label,
  };
};

const registerModes = (input: RegisterWorkbenchExtensionContributionsInput, registry: WorkbenchCompositionRegistry) =>
  input.metadata.modes.map((mode) => {
    // Seed and reconcile run the same composition pass with different jobs. The mode
    // registry seeds a scope once and reconciles on every later activation, so it — not
    // a guess about persisted state — decides when the recipe's optional placements open.
    const applyComposition = (ctx: WorkbenchModeActivationContext, seeding: boolean) => {
      reconcileCompositionLayout(
        { layout: ctx.layout, notifications: ctx.notifications },
        { registry, modeId: mode.modeId, resourceKind: ctx.navigator.getSelectedResource()?.kind, seeding },
      );
      // Reveal the Side Panel when the recipe placed something there so the mode's
      // declared layout is visible the first time it opens.
      if (ctx.layout.getLayout().regions.side.widgets.length > 0) ctx.shell.setSidePanelPresentation("attached");
    };

    return input.workbench.modes.registerMode({
      id: mode.modeId,
      label: text(mode.label, mode.modeId),
      panels: mode.panelRegions,
      resourceKinds: Object.keys(mode.resources ?? {}),
      defaultResource: toModeDefaultResource(input, mode.defaultResource),
      listAddablePanels: ({ layout, resource }) =>
        listCompositionAddablePanels({
          registry,
          modeId: mode.modeId,
          layout,
          resourceKind: resource?.kind,
        }).filter((panel): panel is typeof panel & { region: WorkbenchPanelRegion } =>
          workbenchPanelRegions.includes(panel.region as WorkbenchPanelRegion),
        ),
      activate: () => undefined,
      seed: (ctx: WorkbenchModeActivationContext) => applyComposition(ctx, true),
      reconcile: (ctx: WorkbenchModeActivationContext) => applyComposition(ctx, false),
    });
  });

export const registerWorkbenchExtensionContributions = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const disposables: Disposable[] = [];
  const context: WorkbenchExtensionCommandContext = input;

  registerBridgeRenderer(input, disposables);
  disposables.push(...registerCommands(context, input.metadata));
  disposables.push(...registerMenus(input, context));
  disposables.push(...registerCommandPaletteContributions(input, context));
  disposables.push(registerWorkbenchExtensionTreeRenderers(input));
  disposables.push(registerWorkbenchExtensionFileRenderers(input));
  disposables.push(...registerWebviewPanels(input));
  disposables.push(
    registerWorkbenchExtensionKanbanRenderers(
      context,
      input.metadata.kanbanRenderers ?? [],
      undefined,
      input.metadata.panels,
      input.metadata.resourcePanels,
    ),
  );
  disposables.push(
    registerWorkbenchExtensionDataTableRenderers(
      context,
      input.metadata.dataTableRenderers ?? [],
      input.metadata.panels,
      input.metadata.resourcePanels,
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
  disposables.push(...registerStatusItems(input));
  disposables.push(...registerResourcePresenters(input));
  const composition = registerComposition(input);
  disposables.push(...composition.disposables);
  disposables.push(...registerModes(input, composition.registry));

  return {
    dispose() {
      disposeAll(disposables);
    },
  };
};
