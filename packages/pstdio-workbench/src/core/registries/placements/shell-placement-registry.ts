import type { PageOpenIntent, PlacementIdentity } from "@pstdio/sdk/extensions";
import { createDisposable, type Disposable } from "../../shared/disposable";
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
  openResourcePlacement,
  openStaticPlacement,
  staticPlacementClosable,
  updateResourcePlacementInstance,
  validateOwnedPlacementItem,
  type WorkbenchOwnedPlacementItem,
} from "./owned-placement-lifecycle";

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
  updatePlacement(identity: PlacementIdentity, input: { resource?: ResourceRef; title?: string }): void;
  closePlacement(identity: PlacementIdentity): void;
  resolvePlacements(): readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
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
  enteredWithPersistedLayout(): boolean;
  onDidChangePersistenceScope(listener: () => void): Disposable;
}): WorkbenchShellPlacementRegistry => {
  const placements = new Map<string, WorkbenchShellPlacementContribution>();
  const state = createOwnedPlacementState();
  const listeners = new Set<() => void>();
  const label = "Shell placement";

  const emitChange = () => {
    for (const listener of listeners) listener();
  };

  // A restored layout snapshot is the user's saved choice: placements present in
  // it are open, optional placements missing from it are closed. A scope without
  // a snapshot starts from each placement's declared presence.
  const restorePlacement = (placement: WorkbenchShellPlacementContribution) => {
    if (!input.enteredWithPersistedLayout()) {
      clearOwnedPlacementState(state, placement.id);
      return;
    }
    const saved = Object.values(input.getLayout().regions)
      .flatMap((region) => region.widgets)
      .filter(
        (candidate) =>
          candidate.placementIdentity?.kind === "shell" && candidate.placementIdentity.placementId === placement.id,
      );
    if (placement.item.kind === "view") {
      if (placement.item.presence === "fixed") return;
      state.staticOverrides.set(
        placement.id,
        saved.some((candidate) => candidate.placementIdentity?.instanceKey === "default") ? "open" : "closed",
      );
      return;
    }
    state.resourceInstances.set(
      placement.id,
      saved.flatMap((candidate) => {
        if (!candidate.resource) return [];
        return [
          {
            instanceKey: candidate.resource.uri,
            resource: candidate.resource,
            title: candidate.title,
            open: candidate.tabRetention === "preview" ? ("preview" as const) : ("pin" as const),
          },
        ];
      }),
    );
  };

  input.onDidChangePersistenceScope(() => {
    for (const placement of placements.values()) restorePlacement(placement);
    emitChange();
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
          viewId: placement.item.viewId,
          role: roleForRegion(placement.region),
          closable: staticPlacementClosable(placement.item),
          ...(resource ? { resource } : {}),
          ...(title ? { title } : {}),
          ...tabState(open),
        },
      ),
    };
  };

  return {
    registerPlacement(placement) {
      if (placements.has(placement.id)) throw new Error(`Shell placement already registered: ${placement.id}`);
      if (!input.views.getView(placement.item.viewId)) {
        throw new Error(`Workbench shell placement view is not registered: ${placement.item.viewId}`);
      }
      validateOwnedPlacementItem(label, placement.id, placement.item);
      const registered = { ...placement, item: { ...placement.item } };
      const panel = registerWorkbenchViewPlacement(
        input.registerPanel,
        input.views,
        {
          ...registered,
          id: shellPlacementContributionId(registered.id),
          viewId: registered.item.viewId,
          role: roleForRegion(registered.region),
          singleton: registered.item.kind === "view" || registered.item.cardinality === "one",
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
      const placement = placements.get(target.placementId);
      if (!placement) throw new Error(`Unknown shell placement: ${target.placementId}`);
      if (placement.item.kind === "view") {
        openStaticPlacement({ label, id: placement.id, item: placement.item, state, ...target });
        emitChange();
        input.activatePanel(`workbench.shell.${encodeURIComponent(placement.id)}.default`);
        return identityFor(placement.id, "default");
      }
      const instanceKey = openResourcePlacement({ label, id: placement.id, item: placement.item, state, ...target });
      emitChange();
      input.activatePanel(`workbench.shell.${encodeURIComponent(placement.id)}.${encodeURIComponent(instanceKey)}`);
      return identityFor(placement.id, instanceKey);
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

    resolvePlacements() {
      return [...placements.values()].flatMap((placement) => {
        if (placement.item.kind === "view") {
          return isStaticPlacementOpen(placement.item, state, placement.id) ? [resolve(placement, "default")] : [];
        }
        return (state.resourceInstances.get(placement.id) ?? []).map((instance) =>
          resolve(placement, instance.instanceKey, instance.resource, instance.open, instance.title),
        );
      });
    },

    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
