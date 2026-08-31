import type { ResourceRef as PageResourceRef } from "@pstdio/sdk/extensions";
import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { reconcileOwnedWidgetLayout } from "../../registries/layout/owned-placement-layout";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchModePlacementRegistry } from "../../registries/modes/mode-placement-registry";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import { activateWorkbenchPageMode } from "../../registries/modes/mode-registry-internals";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPagePlacementInput,
  type WorkbenchPageRegistry,
  type WorkbenchPageRegistryStoreState,
  type WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchViewRegistry } from "../../registries/views/view-registry";
import { createDisposable } from "../../shared/disposable";

export interface ConnectWorkbenchPageRuntimeInput {
  layout: LayoutModel;
  modes: WorkbenchModeRegistry;
  registry: WorkbenchPageRegistry<WorkbenchWidgetPlacement>;
}

const applyPageState = (
  input: ConnectWorkbenchPageRuntimeInput,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  if (!state.projectId && !state.activePageId && !state.activeModeId) return;
  const layout = reconcileOwnedWidgetLayout({
    layout: input.layout.getLayout(),
    placements: state.placements,
    activate: state.reconciliation.activate.map((placement) => placement.identity),
  });
  activateWorkbenchPageMode(input.modes, state.activeModeId, () => input.layout.restoreLayout(layout));
};

export const connectWorkbenchPageRuntime = (input: ConnectWorkbenchPageRuntimeInput) => {
  const runtime = getWorkbenchPageRegistryInternals(input.registry).connectRuntime((state) =>
    applyPageState(input, state),
  );
  const scope = input.layout.onDidChangePersistenceScope(() => applyPageState(input, input.registry.store.getState()));
  return createDisposable(() => {
    scope.dispose();
    runtime.dispose();
  });
};

const parsePageResourceUri = (uri: string) => {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "pstdio:" || parsed.hostname !== "extension-resource") return undefined;
    const [type, id, ...rest] = parsed.pathname.slice(1).split("/");
    if (!type || !id || rest.length > 0) return undefined;
    return { type: decodeURIComponent(type), id: decodeURIComponent(id) };
  } catch {
    return undefined;
  }
};

export const defaultPageResourceCodec: WorkbenchPageResourceCodec = {
  normalize: (resource) => ({ ...resource }),
  toUri: (resource) =>
    `pstdio://extension-resource/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}`,
  fromUri: parsePageResourceUri,
};

const toWorkbenchResource = (resource: PageResourceRef, codec: WorkbenchPageResourceCodec) => ({
  kind: resource.type,
  uri: codec.toUri(resource),
  id: resource.id,
  label: resource.label,
  metadata: resource.metadata,
});

const toTabState = (open: WorkbenchPagePlacementInput["open"]) => {
  if (!open) return {};
  if (open === "pin") return { pinned: true, tabRetention: "persistent" as const };
  return { pinned: false, tabRetention: "preview" as const };
};

const toWidgetPlacement = (
  input: WorkbenchPagePlacementInput,
  resources: WorkbenchPageResourceCodec,
  views: WorkbenchViewRegistry,
): WorkbenchWidgetPlacement => {
  const resource = input.resource ? toWorkbenchResource(input.resource, resources) : undefined;
  const view = views.getView(input.viewId);
  if (!view) throw new Error(`Workbench page view is not registered: ${input.viewId}`);
  return {
    widgetId: `workbench.page.${encodeURIComponent(placementIdentityKey(input.identity))}`,
    contributionId: view.panelId,
    viewId: input.viewId,
    role: input.role === "primary" ? "location" : "sub-panel",
    closable: input.closable,
    ...(input.section ? { section: input.section } : {}),
    ...(resource ? { resource, resourceUri: resource.uri, title: resource.label } : {}),
    ...toTabState(input.open),
  };
};

export interface CreateLiveWorkbenchPageRegistryInput {
  layout: LayoutModel;
  modePlacements: WorkbenchModePlacementRegistry;
  modes: WorkbenchModeRegistry;
  resources?: WorkbenchPageResourceCodec;
  views: WorkbenchViewRegistry;
}

export const createLiveWorkbenchPageRegistry = (input: CreateLiveWorkbenchPageRegistryInput) => {
  const resources = input.resources ?? defaultPageResourceCodec;
  const registry = createWorkbenchPageRegistry<WorkbenchWidgetPlacement>({
    resolveShellPlacements: () => [],
    resolveModePlacements: (modeId, current) => input.modePlacements.resolvePlacements(modeId, current),
    resolvePagePlacement: (placement) => toWidgetPlacement(placement, resources, input.views),
    resources,
    valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  });
  connectWorkbenchPageRuntime({ layout: input.layout, modes: input.modes, registry });
  input.modePlacements.onDidChange(() => getWorkbenchPageRegistryInternals(registry).refreshModePlacements());
  return registry;
};
