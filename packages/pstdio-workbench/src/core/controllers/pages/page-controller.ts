import type {
  OpenWorkbenchPanelInput,
  WorkbenchPanelOpenStrategy,
  WorkbenchRegion,
} from "../../registries/layout/layout-types";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRegistry,
  WorkbenchPageSlot,
} from "../../registries/pages/page-registry";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import { createPageComposer } from "./page-composer";
import {
  activeLocationResource,
  locationChangeReason,
  type PageLayoutApi,
  slotInstancesIn,
} from "./page-composition-rules";

// The page controller owns "which page is on the bench". It composes the regions a
// page declares (the mode keeps every other region), places resources through the
// page's bindings, and publishes the navigable location `(page, resource?)` that the
// URL, history, and boot restore all share.

export interface WorkbenchPageLocation {
  pageId: string;
  resource?: ResourceRef;
  // How the location changed: activations and pins push history entries, previews
  // replace the current one.
  reason: "activate" | "preview" | "pin";
}

export interface OpenWorkbenchPageInput {
  resource?: ResourceRef;
  slot?: string;
  open?: "preview" | "pin";
}

export interface WorkbenchPagesControllerStoreState {
  activePageId?: string;
  activeResourceUri?: string;
  lastReason?: WorkbenchPageLocation["reason"];
}

export interface CreatePageControllerInput {
  pages: WorkbenchPageRegistry;
  layout: PageLayoutApi;
  openPanel: (panelId: string, input?: OpenWorkbenchPanelInput) => { instanceId: string };
  // Rotates layout persistence to the page's scope BEFORE composing, so per-page
  // arrangement persists and restores. Returns true when a persisted arrangement was
  // restored (reconcile) rather than freshly created (seed).
  applyPageScope?: (page: WorkbenchPageContribution) => boolean;
  // Restores the mode's composition after a page releases regions it declared.
  restoreModeRegions?: (regions: WorkbenchRegion[]) => void;
  warn?: (message: string) => void;
}

export interface WorkbenchPagesController {
  store: WorkbenchStore<WorkbenchPagesControllerStoreState>;
  registry: WorkbenchPageRegistry;
  getActivePage(): WorkbenchPageContribution | undefined;
  getActiveLocation(): WorkbenchPageLocation | undefined;
  activatePage(pageId: string, input?: OpenWorkbenchPageInput): Promise<unknown>;
  // An in-page emission: the active page's bindings place the resource.
  emitResource(resource: ResourceRef, input?: { open?: "preview" | "pin" }): Promise<unknown>;
  // Reveal a closed static slot (from a page target's `slot` or the add-panel menu).
  revealSlot(slotId: string): void;
  // The regions the active page declares: they show the page's composition (or its
  // placeholder), never mode furniture, and skip anchor reconciliation.
  activeDeclaredRegions(): WorkbenchRegion[];
  // The page's closed closable static slots, for a region's add-panel menu.
  closedSlots(region: WorkbenchRegion): WorkbenchPageSlot[];
  // Releases the active page: its composed panels leave the regions it declared, so
  // the incoming mode composes a clean bench.
  deactivate(): void;
  // Recomposes the active page against the current registry. The app calls this after
  // re-registering contributions, so a page whose panels were replaced comes back.
  reconcile(): void;
  // Re-syncs `follows` slots when the user activates another tab in a followed slot.
  handleActiveWidgetChange(): void;
  // How the location last changed; history replaces preview swaps and pushes the rest.
  getLastReason(): WorkbenchPageLocation["reason"] | undefined;
  // The app wires scope rotation and mode restoration after core creation.
  configureHooks(hooks: Pick<CreatePageControllerInput, "applyPageScope" | "restoreModeRegions">): void;
  onDidChangeLocation(listener: (location: WorkbenchPageLocation) => void): Disposable;
}

export const createPageController = (input: CreatePageControllerInput): WorkbenchPagesController => {
  const store = createWorkbenchStore<WorkbenchPagesControllerStoreState>({
    name: "workbench.pages.active",
    initialState: {},
  });
  const listeners = new Set<(location: WorkbenchPageLocation) => void>();
  const warn = input.warn ?? (() => {});
  const hooks: Pick<CreatePageControllerInput, "applyPageScope" | "restoreModeRegions"> = {
    applyPageScope: input.applyPageScope,
    restoreModeRegions: input.restoreModeRegions,
  };

  const emitLocation = (location: WorkbenchPageLocation) => {
    store.setState(
      { activePageId: location.pageId, activeResourceUri: location.resource?.uri, lastReason: location.reason },
      false,
      "pages.location",
    );
    for (const listener of listeners) listener(location);
  };

  const getActivePage = () => {
    const id = store.getState().activePageId;
    return id ? input.pages.getPage(id) : undefined;
  };

  const slotInstances = (page: WorkbenchPageContribution, slot: WorkbenchPageSlot) =>
    slotInstancesIn(input.layout, page, slot);

  const { composeRegions, openStaticSlot, releaseRegions } = createPageComposer(input, warn);

  const openBinding = (
    page: WorkbenchPageContribution,
    binding: WorkbenchPageContribution["bindings"][number],
    slot: WorkbenchPageSlot,
    resource: ResourceRef,
    open: "preview" | "pin" | undefined,
  ) => {
    if (!input.layout.getPanel(binding.panelId)) {
      warn(`Page "${page.id}" binding for "${binding.kind}" names an unregistered panel "${binding.panelId}"`);
      return undefined;
    }
    let strategy: WorkbenchPanelOpenStrategy;
    let pinned = true;
    if (slot.cardinality === "one") {
      const existing = slotInstances(page, slot).find((widget) => widget.resourceUri !== resource.uri);
      strategy = existing
        ? { kind: "replace-panel", instanceId: existing.widgetId, retention: "persistent" }
        : { kind: "persistent" };
    } else if (open === "pin") {
      strategy = { kind: "persistent" };
    } else {
      strategy = { kind: "preview" };
      pinned = false;
    }
    return input.openPanel(binding.panelId, {
      region: slot.region,
      role: slot.region === "main" ? "location" : "sub-panel",
      resource,
      closable: slot.closable,
      pinned,
      pageId: page.id,
      strategy,
      title: resource.label,
    });
  };

  // A page target or emission fills every slot the page binds for the resource's kind.
  const openBound = (page: WorkbenchPageContribution, resource: ResourceRef, open?: "preview" | "pin") => {
    const bindings = page.bindings.filter((binding) => binding.kind === resource.kind);
    if (bindings.length === 0) {
      warn(`Page "${page.id}" does not bind resource kind "${resource.kind}"`);
      return undefined;
    }
    let primary: { instanceId: string } | undefined;
    for (const binding of bindings) {
      const slot = page.slots.find((candidate) => candidate.id === binding.slot);
      if (!slot) continue;
      const instance = openBinding(page, binding, slot, resource, open);
      if (instance && (!primary || slot.region === "main")) primary = instance;
    }
    return primary;
  };

  const syncFollowers = (page: WorkbenchPageContribution, resource: ResourceRef | undefined) => {
    if (!resource) return;
    for (const follower of page.slots) {
      if (!follower.follows) continue;
      const followed = page.slots.find((candidate) => candidate.id === follower.follows);
      if (!followed) continue;
      const binding = page.bindings.find(
        (candidate) => candidate.slot === follower.id && candidate.kind === resource.kind,
      );
      // The follower renders only kinds it binds; anything else leaves it untouched.
      if (!binding) continue;
      const current = slotInstances(page, follower)[0];
      if (current?.resourceUri === resource.uri) continue;
      openBinding(page, binding, follower, resource, "pin");
    }
  };

  const activeBoundResource = () => {
    const page = getActivePage();
    return page ? activeLocationResource(input.layout, page) : undefined;
  };

  const controller: WorkbenchPagesController = {
    store,
    registry: input.pages,

    getActivePage,

    getActiveLocation() {
      const state = store.getState();
      if (!state.activePageId) return undefined;
      return { pageId: state.activePageId, resource: activeBoundResource(), reason: "activate" };
    },

    async activatePage(pageId, activation = {}) {
      const page = input.pages.getPage(pageId);
      if (!page) throw new Error(`Workbench page not registered: ${pageId}`);

      // Read before the page is published as activating: that write clears the
      // resource, and how this location is recorded depends on whether the page was
      // already showing one.
      const previousResourceUri = store.getState().activeResourceUri;
      const reason = activation.resource
        ? locationChangeReason(activation.open, previousResourceUri)
        : ("activate" as const);

      if (page.activate) {
        // A host page is on the bench before it composes. Its own machinery rotates the
        // layout scope and writes the breadcrumb while `activate` runs, and both ask the
        // controller which page is active: answering with the outgoing page would file
        // the host Location under that page's saved arrangement.
        store.setState(
          { activePageId: pageId, activeResourceUri: activation.resource?.uri, lastReason: "activate" },
          false,
          "pages.activating",
        );
        const result = await page.activate(activation);
        emitLocation({ pageId, resource: activation.resource, reason });
        return result;
      }

      const previous = getActivePage();
      if (previous?.id === page.id) {
        // Re-activating the page that is already on the bench keeps its scope and
        // arrangement, but still reconciles: native views can open a Location in a
        // region this page declares, and the page must take that region back.
        composeRegions(page, false);
      } else {
        const restored = hooks.applyPageScope?.(page) ?? false;
        // The page owns the bench from here on. Composing its slots changes the layout,
        // and a snapshot taken during that change must already read as this page's
        // location — otherwise history files the page's own board as a bare widget
        // entry and replaying it clears the trail instead of returning to the page.
        // It cannot move above `applyPageScope`: that hook may commit a mode, and the
        // mode change would deactivate the page it just took over.
        // `lastReason` travels with the page: leaving the previous page's reason in
        // place lets a snapshot taken mid-activation replace the entry it should push.
        store.setState(
          { activePageId: page.id, activeResourceUri: undefined, lastReason: "activate" },
          false,
          "pages.activating",
        );
        composeRegions(page, !restored);
        const released = previous
          ? [...new Set(previous.slots.map((slot) => slot.region))].filter(
              (region) => !page.slots.some((slot) => slot.region === region),
            )
          : [];
        if (released.length > 0) hooks.restoreModeRegions?.(released);
      }

      if (activation.slot) {
        const slot = page.slots.find((candidate) => candidate.id === activation.slot);
        if (slot?.panelId) openStaticSlot(page, slot);
      }
      let opened: unknown;
      if (activation.resource) {
        opened = openBound(page, activation.resource, activation.open);
        syncFollowers(page, activation.resource);
      }
      emitLocation({ pageId, resource: activation.resource, reason });
      return opened;
    },

    async emitResource(resource, emission = {}) {
      const page = getActivePage();
      if (!page) {
        warn(`Resource emission for "${resource.kind}" ignored: no page is active`);
        return undefined;
      }
      const reason = locationChangeReason(emission.open, store.getState().activeResourceUri);
      if (page.emit) {
        const result = await page.emit(resource, emission);
        emitLocation({ pageId: page.id, resource, reason });
        return result;
      }
      const opened = openBound(page, resource, emission.open);
      if (!opened) return undefined;
      syncFollowers(page, resource);
      emitLocation({ pageId: page.id, resource, reason });
      return opened;
    },

    revealSlot(slotId) {
      const page = getActivePage();
      const slot = page?.slots.find((candidate) => candidate.id === slotId);
      if (page && slot) openStaticSlot(page, slot);
    },

    activeDeclaredRegions() {
      const page = getActivePage();
      return page ? [...new Set(page.slots.map((slot) => slot.region))] : [];
    },

    closedSlots(region) {
      const page = getActivePage();
      if (!page) return [];
      return page.slots.filter(
        (slot) => slot.region === region && slot.panelId && slot.closable && slotInstances(page, slot).length === 0,
      );
    },

    deactivate() {
      const page = getActivePage();
      // Host pages compose through their own machinery, so they own their teardown.
      if (page && !page.activate) releaseRegions(page);
      // Replace, not merge: a merged empty object would leave the active page id set.
      store.setState({}, true, "pages.deactivate");
    },

    reconcile() {
      const page = getActivePage();
      if (!page || page.activate) return;
      composeRegions(page, false);
    },

    handleActiveWidgetChange() {
      const page = getActivePage();
      if (!page) return;
      const resource = activeBoundResource();
      if (!page.activate) syncFollowers(page, resource);
      const current = store.getState().activeResourceUri;
      if (resource?.uri !== current) {
        emitLocation({ pageId: page.id, resource, reason: locationChangeReason(undefined, current) });
      }
    },

    getLastReason() {
      return store.getState().lastReason;
    },

    configureHooks(next) {
      if (next.applyPageScope) hooks.applyPageScope = next.applyPageScope;
      if (next.restoreModeRegions) hooks.restoreModeRegions = next.restoreModeRegions;
    },

    onDidChangeLocation(listener) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };

  return controller;
};
