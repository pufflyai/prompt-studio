import { text } from "pstdio-extensions/workbench";
import type { Disposable, ResourceRef, WorkbenchModeActivationContext, WorkbenchPanelRegion } from "../../core";
import { workbenchPanelRegions } from "../../core";
import {
  createWorkbenchCompositionRegistry,
  listCompositionAddablePanels,
  reconcileCompositionLayout,
  toPanelPlacements,
  type WorkbenchCompositionRegistry,
} from "../contributions/composition-contributions";
import type { InternalWorkbenchExtensionMetadata } from "./internal-workbench-extension-metadata";
import type { InternalRegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

interface ResourceKindPresenterRecord {
  extensionId?: string;
  icon?: string;
  label?: string;
  surface: "primary" | "secondary" | "attached";
}

interface ResourcePresenterPanel {
  edge?: InternalWorkbenchExtensionMetadata["resourcePanels"][number];
  panel: InternalWorkbenchExtensionMetadata["panels"][number];
  placement?: { for?: string; region: string };
}

const collectResourceKindPresenterRecords = (metadata: InternalWorkbenchExtensionMetadata) => {
  const records = new Map<string, ResourceKindPresenterRecord>();
  for (const kind of metadata.resourceKinds ?? []) {
    records.set(kind.id, {
      surface: kind.surface,
      extensionId: kind.extensionId,
      label: kind.label ? text(kind.label, kind.id) : undefined,
      icon: kind.icon,
    });
  }
  for (const renderer of metadata.kanbanRenderers ?? []) {
    if (renderer.resourceKind && !records.has(renderer.resourceKind)) {
      records.set(renderer.resourceKind, { surface: "primary" });
    }
  }
  return records;
};

const resourcePresenterPanels = (
  metadata: InternalWorkbenchExtensionMetadata,
  kind: string,
  ownerExtensionId: string | undefined,
) => {
  const edges = (metadata.resourcePanels ?? []).filter((edge) => edge.resourceKind === kind);
  const panels: ResourcePresenterPanel[] = edges.flatMap((edge) => {
    const panel = metadata.panels.find((candidate) => candidate.id === edge.panel);
    return panel ? [{ edge, panel }] : [];
  });
  const edgePanelIds = new Set(panels.map(({ panel }) => panel.id));
  for (const panel of metadata.panels) {
    if (edgePanelIds.has(panel.id) || panel.extensionId !== ownerExtensionId) continue;
    const placements = panel.show ? (Array.isArray(panel.show) ? panel.show : [panel.show]) : [];
    const placement = placements.find((candidate) => candidate.for === kind);
    if (placement) panels.push({ panel, placement });
  }
  return panels;
};

const placedPanelRegion = (input: InternalRegisterWorkbenchExtensionContributionsInput, panelId: string) => {
  const layout = input.workbench.layout.getLayout();
  const dockedRegions = ["sidenav", "main", "secondary", "side"] as const;
  return dockedRegions.find((region) =>
    layout.regions[region].widgets.some((placement) => placement.contributionId === panelId),
  );
};

const openResourcePresenter = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  panels: readonly ResourcePresenterPanel[],
  resource: ResourceRef,
) => {
  input.prepareResource?.(resource);
  const instances = panels.map(({ panel }) =>
    input.workbench.layout.openPanel(panel.id, {
      region: placedPanelRegion(input, panel.id),
      resource,
      title: resource.label ?? resource.id ?? resource.uri,
      strategy: { kind: "persistent" },
    }),
  );
  if (
    input.workbench.sidePanel.getMode() === "closed" &&
    panels.some(({ panel }) => placedPanelRegion(input, panel.id) === "side")
  ) {
    input.workbench.sidePanel.setMode("attached");
  }
  const primaryIndex = panels.findIndex(
    (entry) => entry.edge?.slot === "primary" || entry.placement?.region === "main",
  );
  return instances[primaryIndex >= 0 ? primaryIndex : 0]!;
};

const registerResourceKindPresenter = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  kind: string,
  record: ResourceKindPresenterRecord,
) => {
  const disposables: Disposable[] = [];
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
  const panels = resourcePresenterPanels(input.metadata, kind, record.extensionId);
  if (panels.length === 0) return disposables;
  disposables.push(
    input.workbench.resources.registerPresenter({
      id: `workbench.extension.resource.${kind}`,
      canOpen: (resource) => resource.kind === kind,
      open: (resource) => openResourcePresenter(input, panels, resource),
    }),
  );
  return disposables;
};

export const registerResourcePresenters = (input: InternalRegisterWorkbenchExtensionContributionsInput) =>
  [...collectResourceKindPresenterRecords(input.metadata)].flatMap(([kind, record]) =>
    registerResourceKindPresenter(input, kind, record),
  );

export const registerComposition = (input: InternalRegisterWorkbenchExtensionContributionsInput) => {
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
        show: toPanelPlacements(panel.show),
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
        extensionId: mode.extensionId,
        resources: mode.resources,
        modePanels: mode.modePanels,
      }),
    );
  }
  return { registry, disposables };
};

type WorkbenchExtensionModeRecord = InternalWorkbenchExtensionMetadata["modes"][number];

const extensionResourceUri = (type: string, id: string) =>
  `pstdio://extension-resource/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;

const toModeDefaultResource = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
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

export const registerModes = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  registry: WorkbenchCompositionRegistry,
) =>
  input.metadata.modes.map((mode) => {
    const applyComposition = (ctx: WorkbenchModeActivationContext, seeding: boolean) => {
      reconcileCompositionLayout(
        { layout: ctx.layout, notifications: ctx.notifications },
        { registry, modeId: mode.modeId, resourceKind: ctx.navigator.getSelectedResource()?.kind, seeding },
      );
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
