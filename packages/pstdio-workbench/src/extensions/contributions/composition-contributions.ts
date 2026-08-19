import { resolveComposition } from "../../core/registries/layout/composition-resolver";
import type {
  CompositionModeDefinition,
  CompositionPanelDefinition,
  CompositionResourceKindDefinition,
  CompositionResourcePanelEdge,
  DockedCompositionRegion,
  PersistedCompositionLayout,
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

const hasAnyKnownPlacement = (layout: ReturnType<LayoutModel["getLayout"]>, knownPanelIds: ReadonlySet<string>) =>
  dockedCompositionRegions.some((region) =>
    layout.regions[region].widgets.some((placement) => knownPanelIds.has(placement.contributionId)),
  );

export const compositionRequiredNotificationId = (modeId: string) => `workbench.composition.required.${modeId}`;

// Reconciles the docked layout for one mode-resource context against the registered
// composition. Runs on every context activation: it restores missing required
// structure, enforces resolved closability, and reports unresolved required
// placements once through a stable notification id (repeated reconciliation updates
// the same diagnostic instead of stacking toasts).
export const reconcileCompositionLayout = (
  ctx: CompositionReconcileContext,
  input: { registry: WorkbenchCompositionRegistry; modeId: string; resourceKind?: string },
) => {
  const mode = input.registry.getModeComposition(input.modeId);
  if (!mode) return undefined;
  const composition = input.registry.getComposition();
  const knownPanelIds = new Set(composition.panels.map((panel) => panel.id));
  const layout = ctx.layout.getLayout();
  // A scope counts as new only when nothing was persisted for it and none of the
  // composition's panels are placed; a reselect after closing optional panels keeps
  // the user's choices.
  const isNewScope = !ctx.layout.hasPersistedLayout() && !hasAnyKnownPlacement(layout, knownPanelIds);
  const persisted = isNewScope ? undefined : extractPersistedState(layout, knownPanelIds);

  const resolved = resolveComposition({
    context: { modeId: input.modeId, resourceKind: input.resourceKind },
    mode,
    composition,
    persisted,
  });

  const activeBefore = new Map<DockedCompositionRegion, string | undefined>(
    dockedCompositionRegions.map((region) => [region, ctx.layout.getLayout().regions[region].activeWidgetId]),
  );

  for (const placement of resolved.placements) {
    const current = ctx.layout.getLayout();
    const existing = dockedCompositionRegions
      .flatMap((region) => current.regions[region].widgets)
      .find((candidate) => candidate.contributionId === placement.panelId);
    if (existing) {
      if ((existing.closable ?? true) !== placement.closable) {
        ctx.layout.updateWidgetPlacement(existing.widgetId, { closable: placement.closable });
      }
      continue;
    }
    if (placement.origin === "persisted" || placement.origin === "default" || placement.required) {
      ctx.layout.openWidget(placement.panelId, {
        region: placement.region,
        closable: placement.closable,
        pinned: true,
      });
    }
  }

  // Restoring required structure must not steal the user's active tabs.
  for (const [region, activeWidgetId] of activeBefore) {
    if (!activeWidgetId) continue;
    const current = ctx.layout.getLayout().regions[region];
    if (current.activeWidgetId !== activeWidgetId && current.widgets.some((w) => w.widgetId === activeWidgetId)) {
      ctx.layout.setRegionActiveWidget(region, activeWidgetId);
    }
  }

  ctx.layout.reconcilePanelMenus();

  const notificationId = compositionRequiredNotificationId(input.modeId);
  if (resolved.requiredFallback) {
    const fallbackPlaced = ctx.layout
      .getLayout()
      .regions.main.widgets.some((placement) => placement.contributionId === resolved.requiredFallback?.panelId);
    if (!fallbackPlaced) {
      ctx.layout.openWidget(resolved.requiredFallback.panelId, { region: "main", pinned: true });
    }
    ctx.notifications.show({
      id: notificationId,
      level: "error",
      title: "A required panel could not be placed",
      message: resolved.diagnostics.map((diagnostic) => diagnostic.message).join(" "),
    });
  } else {
    ctx.notifications.dismiss(notificationId);
  }

  return resolved;
};
