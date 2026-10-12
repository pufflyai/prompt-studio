import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchRegion } from "../../registries/layout/layout-types";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type { WorkbenchSidePanelController, WorkbenchSidePanelMode } from "../side-panel/side-panel-controller";
import type { WorkbenchPanelPolicy } from "./panel-policy";

export interface WorkbenchPanelPolicyContext {
  modeId?: string;
  pageId?: string;
  projectId?: string;
  resource?: ResourceRef;
}

export type WorkbenchSidePanelPresentation = WorkbenchSidePanelMode;

export type WorkbenchShellOpenRegion = "sidenav" | "secondary" | "side" | "bottom";

export interface WorkbenchShellRegionState {
  open: boolean;
  size?: number;
}

export interface WorkbenchShellController {
  getRegionState(region: WorkbenchRegion): WorkbenchShellRegionState;
  getPanelPolicy(region: WorkbenchRegion, context?: WorkbenchPanelPolicyContext): WorkbenchPanelPolicy;
  setRegionOpen(region: WorkbenchShellOpenRegion, open: boolean): void | Promise<void>;
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
  openDefault?(region: WorkbenchShellOpenRegion, presentation?: WorkbenchSidePanelMode): unknown | Promise<unknown>;
}): WorkbenchShellController => {
  const opening = new Map<string, Promise<void>>();
  const requireAction = (region: WorkbenchRegion, action: "open" | "close" | "resize") => {
    const policy = input.getPolicy(region);
    if (!policy.provided) throw new Error(`Panel is not provided: ${region}`);
    const allowed = { open: policy.canOpen, close: policy.canClose, resize: policy.resizable }[action];
    if (!allowed) throw new Error(`Panel cannot ${action}: ${region}`);
    return policy;
  };
  const writeIntent = (region: WorkbenchShellOpenRegion, visibility: "open" | "closed" | "auto") => {
    const layout = input.layout.getLayout();
    input.layout.restoreLayout({
      ...layout,
      regions: {
        ...layout.regions,
        [region]: { ...layout.regions[region], visibility, visible: visibility !== "closed" },
      },
    });
  };
  const open = (region: WorkbenchShellOpenRegion, presentation?: WorkbenchSidePanelMode) => {
    const policy = requireAction(region, "open");
    const empty = input.layout.getLayout().regions[region].widgets.length === 0;
    if (empty && policy.defaultTab && !policy.acceptsTabs) throw new Error(`Panel cannot accept tabs: ${region}`);
    writeIntent(region, "open");
    if (region === "side") input.layout.setSidePanelMode(presentation ?? "attached");
    if (!empty) return;
    const key = `${input.getOwnerKey(region)}/${region}`;
    const pending = opening.get(key);
    if (pending) return pending;
    const result = input.openDefault?.(region, presentation);
    if (!result) return;
    const operation = Promise.resolve(result)
      .then(() => {})
      .finally(() => opening.delete(key));
    opening.set(key, operation);
    return operation;
  };
  return {
    getPanelPolicy: input.getPolicy,
    getRegionState(region) {
      const state = input.layout.getLayout().regions[region];
      return { open: input.getPolicy(region).open, size: state.size };
    },

    setRegionOpen(region, isOpen) {
      if (isOpen) return open(region);
      requireAction(region, "close");
      writeIntent(region, "closed");
    },

    revealRegion(region) {
      const policy = input.getPolicy(region);
      if (!policy.open) requireAction(region, "open");
      const layout = input.layout.getLayout();
      const sideWasClosed =
        region === "side" &&
        (layout.regions.side.visibility === "closed" || !policy.open || !layout.regions.side.presentation);
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
      if (presentation === "floating" && input.layout.getRegionSettings("side")?.floatable === false)
        throw new Error("Panel cannot float: side");
      if (presentation === "closed") {
        requireAction("side", "close");
        writeIntent("side", "closed");
        return;
      }
      if (!policy.open) return open("side", presentation);
      input.layout.setSidePanelMode(presentation === "floating" && !policy.floatable ? "attached" : presentation);
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
};
