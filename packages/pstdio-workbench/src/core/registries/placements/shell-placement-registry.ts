import type { PageOpenIntent, PlacementIdentity } from "@pstdio/sdk/extensions";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { notifyWorkbenchChange } from "../../shared/store/workbench-batch";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import { createPlacement } from "../layout/layout-operations";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchRegion,
  WorkbenchWidgetPlacement,
  WorkbenchWidgetRole,
} from "../layout/layout-types";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import type { ResourceRef } from "../resources/resource-registry";
import type { WorkbenchViewMenuRegistry } from "../view-menus/view-menu-registry";
import { registerWorkbenchViewPlacement, type WorkbenchPlacementPresentation } from "../views/view-placement";
import type { WorkbenchViewRegistry } from "../views/view-registry";
import {
  clearOwnedPlacementState,
  closeOwnedPlacementInstance,
  createOwnedPlacementState,
  isStaticPlacementOpen,
  placementItemViewId,
  staticPlacementClosable,
  updateResourcePlacementInstance,
  validateOwnedPlacementItem,
  type WorkbenchOwnedPlacementItem,
} from "./owned-placement-lifecycle";
import {
  type OwnedPlacementLocationContext,
  type OwnedPlacementPreparation,
  prepareOwnedPlacement,
  setOwnedPlacementPreparation,
} from "./owned-placement-preparation";
import { restoreOwnedPlacementState } from "./owned-placement-restoration";
export interface WorkbenchShellPlacementContribution extends WorkbenchPlacementPresentation {
  readonly id: string;
  readonly item: WorkbenchOwnedPlacementItem;
  readonly region: WorkbenchRegion;
  readonly order?: number;
}
export interface OpenWorkbenchShellPlacementInput {
  placementId: string;
  resource?: ResourceRef;
  open?: PageOpenIntent;
  title?: string;
}
export interface WorkbenchShellPlacementRegistry {
  registerPlacement(placement: WorkbenchShellPlacementContribution): Disposable;
  getPlacement(placementId: string): WorkbenchShellPlacementContribution | undefined;
  listPlacements(): WorkbenchShellPlacementContribution[];
  openPlacement(input: OpenWorkbenchShellPlacementInput): PlacementIdentity;
  updatePlacement(
    identity: PlacementIdentity,
    input: {
      resource?: ResourceRef;
      title?: string;
      open?: PageOpenIntent;
    },
  ): void;
  closePlacement(identity: PlacementIdentity): void;
  resolvePlacements(
    context?: OwnedPlacementLocationContext,
  ): readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  onDidChange(listener: () => void): Disposable;
}
export const shellPlacementContributionId = (placementId: string) =>
  `workbench.shell-placement.${encodeURIComponent(placementId)}`;
const identityFor = (placementId: string, instanceKey: string): PlacementIdentity => ({
  kind: "shell",
  placementId,
  instanceKey,
});
const roleForRegion = (region: WorkbenchRegion): WorkbenchWidgetRole => {
  if (region === "main") return "location";
  if (region === "secondary" || region === "side") return "sub-panel";
  return "content";
};
const tabState = (open: PageOpenIntent | undefined) => {
  if (open === "pin") return { pinned: true, tabRetention: "persistent" as const };
  if (open === "preview") return { pinned: false, tabRetention: "preview" as const };
  return {};
};
export const createWorkbenchShellPlacementRegistry = (input: {
  views: WorkbenchViewRegistry;
  viewMenus?: WorkbenchViewMenuRegistry;
  getPanel(panelId: string): RegisteredWidgetContribution | undefined;
  registerPanel: Parameters<typeof registerWorkbenchViewPlacement>[0];
  activatePanel(instanceId: string): unknown;
  getLayout(): WorkbenchLayout;
  getScope?(): string | undefined;
  resolveScope?(context: OwnedPlacementLocationContext): string | undefined;
  loadLayout?(context: OwnedPlacementLocationContext): WorkbenchLayout | undefined;
  enteredWithPersistedLayout(): boolean;
  onDidChangePersistenceScope(listener: () => void): Disposable;
}): WorkbenchShellPlacementRegistry => {
  const placements = new Map<string, WorkbenchShellPlacementContribution>();
  let state = createOwnedPlacementState();
  const listeners = new Set<() => void>();
  const label = "Shell placement";
  let runtime: (() => void) | undefined;
  const emitChange = () => {
    runtime?.();
    for (const listener of listeners)
      notifyWorkbenchChange(listener, () => runWorkbenchEffect("shell placement subscriber", listener));
  };
  // A restored layout snapshot is the user's saved choice: placements present in
  // it are open, optional placements missing from it are closed. A scope without
  // a snapshot starts from each placement's declared presence.
  const restorePlacement = (placement: WorkbenchShellPlacementContribution) => {
    if (!input.enteredWithPersistedLayout()) {
      clearOwnedPlacementState(state, placement.id);
      return;
    }
    state = restoreOwnedPlacementState({
      state,
      declarations: [placement],
      saved: Object.values(input.getLayout().regions).flatMap((region) => region.widgets),
      owns: (identity) => identity.kind === "shell",
    });
  };
  input.onDidChangePersistenceScope(() => {
    for (const placement of placements.values()) restorePlacement(placement);
    notifyWorkbenchChange(placements, emitChange);
  });
  const resolve = (
    placement: WorkbenchShellPlacementContribution,
    instanceKey: string,
    resource?: ResourceRef,
    open?: PageOpenIntent,
    title?: string,
  ): ResolvedOwnedPlacement<WorkbenchWidgetPlacement> => {
    const panel = input.getPanel(shellPlacementContributionId(placement.id));
    if (!panel) throw new Error(`Workbench shell placement is not registered: ${placement.id}`);
    const identity = identityFor(placement.id, instanceKey);
    return {
      identity,
      region: placement.region,
      order: placement.order ?? 0,
      value: createPlacement(
        `workbench.shell.${encodeURIComponent(placement.id)}.${encodeURIComponent(instanceKey)}`,
        panel,
        {
          viewId: placementItemViewId(placement.item),
          role: roleForRegion(placement.region),
          closable: staticPlacementClosable(placement.item),
          ...(resource ? { resource } : {}),
          ...(title ? { title } : {}),
          ...tabState(open),
        },
      ),
    };
  };
  const preparation: OwnedPlacementPreparation = {
    connectRuntime(listener) {
      runtime = listener;
      return createDisposable(() => {
        if (runtime === listener) runtime = undefined;
      });
    },
    getState: () => state,
    restore(context, current = state, previousContext) {
      if (!input.resolveScope) return current;
      const scope = input.resolveScope(context);
      const previousScope = previousContext ? input.resolveScope(previousContext) : input.getScope?.();
      if (scope === previousScope) return current;
      if (scope === input.getScope?.()) return state;
      const layout = input.loadLayout?.(context);
      if (!layout) return createOwnedPlacementState();
      return restoreOwnedPlacementState({
        state: createOwnedPlacementState(),
        declarations: [...placements.values()],
        saved: Object.values(layout.regions).flatMap((region) => region.widgets),
        owns: (identity) => identity.kind === "shell",
      });
    },
    adopt(_modeId, saved, current = state) {
      return restoreOwnedPlacementState({
        state: current,
        declarations: [...placements.values()],
        saved,
        owns: (identity) => identity.kind === "shell",
      });
    },
    open(target, current = state) {
      const placement = placements.get(target.placementId);
      if (!placement) throw new Error(`Unknown shell placement: ${target.placementId}`);
      return prepareOwnedPlacement({
        label,
        target,
        item: placement.item,
        current,
        identityFor: (instanceKey) => identityFor(placement.id, instanceKey),
      });
    },
    apply: (next) => {
      state = next;
    },
    publish: emitChange,
    resolve(_modeId, current = state) {
      return [...placements.values()].flatMap((placement) => {
        if (placement.item.kind === "view") {
          return isStaticPlacementOpen(placement.item, current, placement.id) ? [resolve(placement, "default")] : [];
        }
        return (current.resourceInstances.get(placement.id) ?? []).map((instance) =>
          resolve(placement, instance.instanceKey, instance.resource, instance.open, instance.title),
        );
      });
    },
  };
  const registry: WorkbenchShellPlacementRegistry = {
    registerPlacement(placement) {
      if (placements.has(placement.id)) throw new Error(`Shell placement already registered: ${placement.id}`);
      if (!input.views.getView(placementItemViewId(placement.item))) {
        throw new Error(`Workbench shell placement view is not registered: ${placementItemViewId(placement.item)}`);
      }
      validateOwnedPlacementItem(label, placement.id, placement.item);
      const registered = { ...placement, item: { ...placement.item } };
      const panel = registerWorkbenchViewPlacement(
        input.registerPanel,
        input.views,
        {
          ...registered,
          id: shellPlacementContributionId(registered.id),
          viewId: placementItemViewId(registered.item),
          role: roleForRegion(registered.region),
          singleton: registered.item.kind === "view" || registered.item.binding.cardinality === "one",
          closable: staticPlacementClosable(registered.item),
        },
        input.viewMenus,
      );
      placements.set(registered.id, registered);
      if (input.enteredWithPersistedLayout()) restorePlacement(registered);
      emitChange();
      return createDisposable(() => {
        if (placements.get(registered.id) !== registered) return;
        placements.delete(registered.id);
        clearOwnedPlacementState(state, registered.id);
        panel.dispose();
        emitChange();
      });
    },
    getPlacement: (placementId) => placements.get(placementId),
    listPlacements: () => [...placements.values()].sort((left, right) => left.id.localeCompare(right.id)),
    openPlacement(target) {
      const prepared = preparation.open(target);
      preparation.apply(prepared.state);
      preparation.publish();
      input.activatePanel(
        `workbench.shell.${encodeURIComponent(target.placementId)}.${encodeURIComponent(prepared.identity.instanceKey)}`,
      );
      return prepared.identity;
    },

    closePlacement(identity) {
      if (identity.kind !== "shell") throw new Error("Shell placement registry closes only shell-owned placements");
      const placement = placements.get(identity.placementId);
      if (!placement) return;
      const changed = closeOwnedPlacementInstance({
        label,
        id: placement.id,
        item: placement.item,
        state,
        instanceKey: identity.instanceKey,
      });
      if (changed) emitChange();
    },
    updatePlacement(identity, update) {
      if (identity.kind !== "shell") throw new Error("Shell placement registry updates only shell-owned placements");
      const placement = placements.get(identity.placementId);
      if (!placement) return;
      updateResourcePlacementInstance({
        label,
        id: placement.id,
        item: placement.item,
        state,
        instanceKey: identity.instanceKey,
        ...update,
      });
      emitChange();
    },
    resolvePlacements: (context) => preparation.resolve(undefined, context ? preparation.restore!(context) : state),
    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
  setOwnedPlacementPreparation(registry, preparation);
  return registry;
};
