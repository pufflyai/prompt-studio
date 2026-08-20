import { resolveComposition } from "../../core/registries/layout/composition-resolver";
import type {
  CompositionModeDefinition,
  CompositionPanelDefinition,
  CompositionResourceKindDefinition,
  CompositionResourcePanelEdge,
  DockedCompositionRegion,
  PersistedCompositionLayout,
  ResolvedComposition,
  ResolvedCompositionPlacement,
  WorkbenchComposition,
} from "../../core/registries/layout/composition-resolver-types";
import { dockedCompositionRegions } from "../../core/registries/layout/composition-resolver-types";
import type { LayoutModel } from "../../core/registries/layout/layout-model-types";
import type { NotificationRegistry } from "../../core/registries/notifications/notification-registry";
import { createDisposable, type Disposable } from "../../core/shared/disposable";

// The composition registry holds normalized PS-266 records for the workbench. It
// registers capabilities and recipes only; every placement decision belongs to the
// composition resolver.
export interface WorkbenchCompositionRegistry {
  registerResourceKind(definition: CompositionResourceKindDefinition): Disposable;
  registerPanelCapability(definition: CompositionPanelDefinition): Disposable;
  registerResourcePanel(edge: CompositionResourcePanelEdge): Disposable;
  registerModeComposition(definition: CompositionModeDefinition): Disposable;
  getComposition(): WorkbenchComposition;
  getModeComposition(modeId: string): CompositionModeDefinition | undefined;
}

export const createWorkbenchCompositionRegistry = (): WorkbenchCompositionRegistry => {
  const resourceKinds: CompositionResourceKindDefinition[] = [];
  const panels: CompositionPanelDefinition[] = [];
  const resourcePanels: CompositionResourcePanelEdge[] = [];
  const modes = new Map<string, CompositionModeDefinition>();

  const remove = <T>(list: T[], item: T) =>
    createDisposable(() => {
      const index = list.indexOf(item);
      if (index >= 0) list.splice(index, 1);
    });

  return {
    registerResourceKind(definition) {
      resourceKinds.push(definition);
      return remove(resourceKinds, definition);
    },
    registerPanelCapability(definition) {
      panels.push(definition);
      return remove(panels, definition);
    },
    registerResourcePanel(edge) {
      resourcePanels.push(edge);
      return remove(resourcePanels, edge);
    },
    registerModeComposition(definition) {
      modes.set(definition.id, definition);
      return createDisposable(() => {
        if (modes.get(definition.id) === definition) modes.delete(definition.id);
      });
    },
    getComposition: () => ({
      resourceKinds: [...resourceKinds],
      panels: [...panels],
      resourcePanels: [...resourcePanels],
    }),
    getModeComposition: (modeId) => modes.get(modeId),
  };
};

interface CompositionReconcileContext {
  layout: LayoutModel;
  notifications: NotificationRegistry;
}

const extractPersistedState = (
  layout: ReturnType<LayoutModel["getLayout"]>,
  knownPanelIds: ReadonlySet<string>,
): PersistedCompositionLayout => {
  const regions: PersistedCompositionLayout["regions"] = {};
  for (const region of dockedCompositionRegions) {
    const state = layout.regions[region];
    const order = state.widgets
      .filter((placement) => knownPanelIds.has(placement.contributionId))
      .map((placement) => placement.contributionId);
    const active = state.widgets.find((placement) => placement.widgetId === state.activeWidgetId);
    regions[region] = {
      order,
      activePanelId: active && knownPanelIds.has(active.contributionId) ? active.contributionId : undefined,
    };
  }
  return { regions };
};

export const listCompositionAddablePanels = (input: {
  registry: WorkbenchCompositionRegistry;
  modeId: string;
  layout: ReturnType<LayoutModel["getLayout"]>;
  resourceKind?: string;
}) => {
  const mode = input.registry.getModeComposition(input.modeId);
  if (!mode) return [];
  const composition = input.registry.getComposition();
  const knownPanelIds = new Set(composition.panels.map((panel) => panel.id));
  return resolveComposition({
    context: { modeId: input.modeId, resourceKind: input.resourceKind },
    mode,
    composition,
    persisted: extractPersistedState(input.layout, knownPanelIds),
  }).addablePanels;
};

// A panel declares only what it can render, so its role comes from where the recipe
// puts it: main holds Locations, which tab beside each other, and every other docked
// region holds Sub Panels of the active Location.
const placementRole = (region: DockedCompositionRegion) => (region === "main" ? "location" : "sub-panel");

// Opens or corrects one resolved placement. A placement sitting in a region the
// recipe no longer allows moves to the resolved region; a valid user move stays.
const applyPlacement = (ctx: CompositionReconcileContext, placement: ResolvedCompositionPlacement) => {
  const current = ctx.layout.getLayout();
  const existingRegion = dockedCompositionRegions.find((region) =>
    current.regions[region].widgets.some((candidate) => candidate.contributionId === placement.panelId),
  );
  const open = () =>
    ctx.layout.openWidget(placement.panelId, {
      region: placement.region,
      closable: placement.closable,
      pinned: true,
      role: placementRole(placement.region),
    });

  if (!existingRegion) {
    if (placement.origin === "persisted" || placement.origin === "default" || placement.required) open();
    return;
  }
  if (!placement.allowedRegions.includes(existingRegion)) {
    open();
    return;
  }
  const existing = current.regions[existingRegion].widgets.find(
    (candidate) => candidate.contributionId === placement.panelId,
  );
  if (!existing) return;
  const role = placementRole(existingRegion);
  if ((existing.closable ?? true) !== placement.closable || existing.role !== role) {
    ctx.layout.updateWidgetPlacement(existing.widgetId, { closable: placement.closable, role });
  }
};

// Restoring required structure must not steal the user's active tabs.
const restoreActiveTabs = (
  ctx: CompositionReconcileContext,
  activeBefore: ReadonlyMap<DockedCompositionRegion, string | undefined>,
) => {
  for (const [region, activeWidgetId] of activeBefore) {
    if (!activeWidgetId) continue;
    const current = ctx.layout.getLayout().regions[region];
    if (current.activeWidgetId === activeWidgetId) continue;
    if (current.widgets.some((widget) => widget.widgetId === activeWidgetId)) {
      ctx.layout.setRegionActiveWidget(region, activeWidgetId);
    }
  }
};

// An unresolved required placement shows one diagnostic under a stable id and leaves
// a usable location in main, so repeated reconciliation updates the same message.
const reportRequiredFallback = (ctx: CompositionReconcileContext, modeId: string, resolved: ResolvedComposition) => {
  const notificationId = compositionRequiredNotificationId(modeId);
  if (!resolved.requiredFallback) {
    ctx.notifications.dismiss(notificationId);
    return;
  }
  const fallbackPanelId = resolved.requiredFallback.panelId;
  const placed = ctx.layout
    .getLayout()
    .regions.main.widgets.some((placement) => placement.contributionId === fallbackPanelId);
  if (!placed) ctx.layout.openWidget(fallbackPanelId, { region: "main", pinned: true });
  ctx.notifications.show({
    id: notificationId,
    level: "error",
    title: "A required panel could not be placed",
    message: resolved.diagnostics.map((diagnostic) => diagnostic.message).join(" "),
  });
};

export const compositionRequiredNotificationId = (modeId: string) => `workbench.composition.required.${modeId}`;

// Applies the registered composition to the docked layout for one mode-resource
// context. `seeding` says which job this call is doing, and only the mode registry
// knows: it seeds a scope once, and reconciles on every later activation. Seeding
// places the mode's whole recipe. Reconciling restores missing required structure,
// enforces resolved closability, and keeps the user's optional choices, tab order, and
// moves. Both report an unresolved required placement under a stable notification id,
// so repeated reconciliation updates the same message instead of stacking toasts.
export const reconcileCompositionLayout = (
  ctx: CompositionReconcileContext,
  input: { registry: WorkbenchCompositionRegistry; modeId: string; resourceKind?: string; seeding?: boolean },
) => {
  const mode = input.registry.getModeComposition(input.modeId);
  if (!mode) return undefined;
  const composition = input.registry.getComposition();
  const knownPanelIds = new Set(composition.panels.map((panel) => panel.id));
  const layout = ctx.layout.getLayout();
  const persisted = input.seeding ? undefined : extractPersistedState(layout, knownPanelIds);

  const resolved = resolveComposition({
    context: { modeId: input.modeId, resourceKind: input.resourceKind },
    mode,
    composition,
    persisted,
  });

  const activeBefore = new Map<DockedCompositionRegion, string | undefined>(
    dockedCompositionRegions.map((region) => [region, ctx.layout.getLayout().regions[region].activeWidgetId]),
  );

  for (const placement of resolved.placements) applyPlacement(ctx, placement);
  restoreActiveTabs(ctx, activeBefore);
  ctx.layout.reconcilePanelMenus();
  reportRequiredFallback(ctx, input.modeId, resolved);

  return resolved;
};
