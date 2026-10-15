import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchRegion } from "../../registries/layout/layout-types";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type { WorkbenchSidePanelController, WorkbenchSidePanelMode } from "../side-panel/side-panel-controller";
import type { WorkbenchPanelPolicy } from "./panel-policy";
import { registerShellNavigationScope } from "./shell-navigation-scope";

export interface WorkbenchPanelPolicyContext {
  modeId?: string;
  pageId?: string;
  projectId?: string;
  resource?: ResourceRef;
}

export type WorkbenchSidePanelPresentation = WorkbenchSidePanelMode;

export type WorkbenchShellOpenRegion = "sidenav" | "secondary" | "side" | "bottom" | "aside";

export interface WorkbenchShellRegionState {
  open: boolean;
  size?: number;
}

export interface WorkbenchShellController {
  getRegionState(region: WorkbenchRegion): WorkbenchShellRegionState;
  getPanelPolicy(region: WorkbenchRegion, context?: WorkbenchPanelPolicyContext): WorkbenchPanelPolicy;
  setRegionOpen(
    region: WorkbenchShellOpenRegion,
    open: boolean,
    presentation?: "attached" | "floating",
  ): void | Promise<void>;
  revealRegion(region: WorkbenchShellOpenRegion): void;
  setHeaderVisible(region: WorkbenchRegion, visible: boolean): void;
  setRegionSize(region: WorkbenchRegion, size: number): void;
  getSidePanelPresentation(): WorkbenchSidePanelPresentation;
  setSidePanelPresentation(presentation: WorkbenchSidePanelPresentation): void | Promise<void>;
  onDidChange(listener: () => void): Disposable;
}

export const createWorkbenchShellController = (input: {
  layout: LayoutModel;
  sidePanel: WorkbenchSidePanelController;
  getPolicy(region: WorkbenchRegion, context?: WorkbenchPanelPolicyContext): WorkbenchPanelPolicy;
  getOwnerKey(region: WorkbenchShellOpenRegion): string;
  beforeOpen?(region: WorkbenchShellOpenRegion, presentation?: WorkbenchSidePanelMode): void;
  getOpenSidePresentation?(): "attached" | "floating" | undefined;
  getDefaultTarget?(
    region: WorkbenchShellOpenRegion,
    presentation?: WorkbenchSidePanelMode,
  ): WorkbenchPanelPolicy["defaultTab"];
  openDefault?(
    target: NonNullable<WorkbenchPanelPolicy["defaultTab"]>,
    run: <T>(action: () => T) => T,
  ): unknown | Promise<unknown>;
}): WorkbenchShellController => {
  type Opening = { completion: Promise<void>; intent: "open" | "closed" | "auto" };
  const opening = new Map<string, Opening>();
  let revealingDefault: Opening | undefined;
  const runNavigation = <T>(operation: Opening | undefined, action: () => T) => {
    const previous = revealingDefault;
    revealingDefault = operation;
    try {
      return action();
    } finally {
      revealingDefault = previous;
    }
  };
  const ownerKey = (region: WorkbenchShellOpenRegion) => `${input.getOwnerKey(region)}/${region}`;
  const requireAction = (region: WorkbenchRegion, action: "open" | "close" | "resize") => {
    const policy = input.getPolicy(region);
    if (!policy.provided) throw new Error(`Panel is not provided: ${region}`);
    const allowed = { open: policy.canOpen, close: policy.canClose, resize: policy.resizable }[action];
    if (!allowed) throw new Error(`Panel cannot ${action}: ${region}`);
    return policy;
  };
  const writeIntent = (
    region: WorkbenchShellOpenRegion,
    visibility: "open" | "closed" | "auto",
    presentation?: "attached" | "floating",
  ) => {
    const operation = opening.get(ownerKey(region));
    if (operation && visibility !== "auto") operation.intent = visibility;
    const layout = input.layout.getLayout();
    input.layout.restoreLayout({
      ...layout,
      regions: {
        ...layout.regions,
        [region]: {
          ...layout.regions[region],
          visibility,
          visible: visibility !== "closed",
          ...(presentation ? { presentation } : {}),
        },
      },
    });
  };
  const resolvePresentation = (presentation: WorkbenchSidePanelMode | undefined, policy: WorkbenchPanelPolicy) => {
    if (presentation === "floating" && input.layout.getRegionSettings("side")?.floatable === false)
      throw new Error("Panel cannot float: side");
    return presentation === "floating" && !policy.floatable ? "attached" : presentation;
  };
  const open = (region: WorkbenchShellOpenRegion, presentation?: WorkbenchSidePanelMode) => {
    const policy = requireAction(region, "open");
    const effectivePresentation = resolvePresentation(presentation, policy);
    const empty = input.layout.getLayout().regions[region].widgets.length === 0;
    const target = input.getDefaultTarget?.(region, presentation) ?? policy.defaultTab;
    if (empty && target && !policy.acceptsTabs) throw new Error(`Panel cannot accept tabs: ${region}`);
    input.beforeOpen?.(region, presentation);
    const sidePresentation = effectivePresentation ?? input.getOpenSidePresentation?.() ?? "attached";
    writeIntent(region, "open", region === "side" && sidePresentation !== "closed" ? sidePresentation : undefined);
    if (!empty) return;
    const key = ownerKey(region);
    const pending = opening.get(key);
    if (pending) return pending.completion;
    if (!target || !input.openDefault) return;
    let complete!: (value: unknown) => void;
    let fail!: (error: unknown) => void;
    const creation = new Promise<unknown>((resolve, reject) => {
      complete = resolve;
      fail = reject;
    });
    const operation: Opening = { completion: Promise.resolve(), intent: "open" };
    operation.completion = creation
      .then(() => {})
      .finally(() => {
        if (opening.get(key) !== operation) return;
        opening.delete(key);
      });
    opening.set(key, operation);
    try {
      complete(input.openDefault(target, (action) => runNavigation(operation, action)));
    } catch (error) {
      fail(error);
    }
    return operation.completion;
  };
  const shell: WorkbenchShellController = {
    getPanelPolicy: input.getPolicy,
    getRegionState(region) {
      const state = input.layout.getLayout().regions[region];
      return { open: input.getPolicy(region).open, size: state.size };
    },

    setRegionOpen(region, isOpen, presentation) {
      if (presentation && region !== "side") throw new Error("Only Side supports a presentation request");
      if (isOpen) return open(region, presentation);
      requireAction(region, "close");
      writeIntent(region, "closed");
    },

    revealRegion(region) {
      const policy = input.getPolicy(region);
      if (!policy.open) requireAction(region, "open");
      const pending = opening.get(ownerKey(region));
      // Only this creation's publication is subject to its saved visibility choice.
      if (pending && revealingDefault === pending && pending.intent === "closed") return;
      if (pending && revealingDefault !== pending) pending.intent = "auto";
      const layout = input.layout.getLayout();
      const sideWasClosed = region === "side" && layout.regions.side.visibility === "closed";
      if (layout.regions[region].visibility === "closed") writeIntent(region, "auto");
      else input.layout.setRegionVisible(region, true);
      if (sideWasClosed) input.layout.setSidePanelMode("attached");
    },

    setHeaderVisible(region, visible) {
      if (!input.getPolicy(region).provided) throw new Error(`Panel is not provided: ${region}`);
      const layout = input.layout.getLayout();
      input.layout.restoreLayout({
        ...layout,
        regions: { ...layout.regions, [region]: { ...layout.regions[region], headerVisible: visible } },
      });
    },

    setRegionSize(region, size) {
      requireAction(region, "resize");
      const bounds = input.layout.getRegionSize(region);
      input.layout.setRegionSize(region, Math.min(bounds?.maxPx ?? Infinity, Math.max(bounds?.minPx ?? 0, size)));
    },

    getSidePanelPresentation: input.sidePanel.getMode,
    setSidePanelPresentation(presentation) {
      const policy = input.getPolicy("side");
      const effectivePresentation = resolvePresentation(presentation, policy);
      if (presentation === "closed") {
        requireAction("side", "close");
        writeIntent("side", "closed");
        return;
      }
      if (!policy.open || (policy.canOpen && !input.layout.getLayout().regions.side.widgets.length))
        return open("side", presentation);
      input.beforeOpen?.("side", presentation);
      input.layout.setSidePanelMode(effectivePresentation!);
    },

    onDidChange(listener) {
      // The Side Panel mode lives in the layout, so one change can reach both sources.
      // A mode policy change moves the panel without a layout change.
      let layout = input.layout.getLayout();
      let sidePanelMode = input.sidePanel.getMode();
      const notify = () => {
        const nextLayout = input.layout.getLayout();
        const nextSidePanelMode = input.sidePanel.getMode();
        if (nextLayout === layout && nextSidePanelMode === sidePanelMode) return;
        layout = nextLayout;
        sidePanelMode = nextSidePanelMode;
        listener();
      };
      const unsubscribeLayout = input.layout.store.subscribeSelector((state) => state.layout, notify);
      const sidePanelSubscription = input.sidePanel.onDidChange(notify);
      return createDisposable(() => {
        unsubscribeLayout();
        sidePanelSubscription.dispose();
      });
    },
  };
  registerShellNavigationScope(shell, { run: (action) => runNavigation(undefined, action) });
  return shell;
};
