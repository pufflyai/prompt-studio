import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchRegion } from "../../registries/layout/layout-types";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type { WorkbenchSidePanelController, WorkbenchSidePanelMode } from "../side-panel/side-panel-controller";

import type { WorkbenchPanelPolicy } from "./panel-policy";

export type WorkbenchSidePanelPresentation = WorkbenchSidePanelMode;

export type WorkbenchShellOpenRegion = "sidenav" | "secondary" | "side";

export interface WorkbenchShellRegionState {
  open: boolean;
  size?: number;
}

export interface WorkbenchShellController {
  getPanelPolicy(region: WorkbenchRegion): WorkbenchPanelPolicy;
  setHeaderVisible(region: WorkbenchRegion, visible: boolean): void;
  getRegionState(region: WorkbenchRegion): WorkbenchShellRegionState;
  setRegionOpen(region: WorkbenchShellOpenRegion, open: boolean): void;
  setRegionSize(region: WorkbenchRegion, size: number): void;
  getSidePanelPresentation(): WorkbenchSidePanelPresentation;
  setSidePanelPresentation(presentation: WorkbenchSidePanelPresentation): void;
  onDidChange(listener: () => void): Disposable;
}

export const createWorkbenchShellController = (input: {
  layout: LayoutModel;
  sidePanel: WorkbenchSidePanelController;
  getPolicy(region: WorkbenchRegion): WorkbenchPanelPolicy;
}): WorkbenchShellController => {
  const requireAction = (region: WorkbenchRegion, action: "open" | "close" | "resize") => {
    const policy = input.getPolicy(region);
    if (!policy.provided) throw new Error(`Panel is not provided: ${region}`);
    const allowed = { open: policy.canOpen, close: policy.canClose, resize: policy.resizable }[action];
    if (!allowed) throw new Error(`Panel cannot ${action}: ${region}`);
  };
  return {
    getPanelPolicy: input.getPolicy,
    setHeaderVisible(region, visible) {
      if (!input.getPolicy(region).provided) throw new Error(`Panel is not provided: ${region}`);
      const layout = input.layout.getLayout();
      input.layout.restoreLayout({
        ...layout,
        regions: { ...layout.regions, [region]: { ...layout.regions[region], headerVisible: visible } },
      });
    },
    getRegionState(region) {
      const state = input.layout.getLayout().regions[region];
      return { open: input.getPolicy(region).open, size: state.size };
    },

    setRegionOpen(region, open) {
      requireAction(region, open ? "open" : "close");
      if (region === "side") {
        if (!open) input.sidePanel.setMode("closed");
        else if (input.sidePanel.getMode() === "closed") input.sidePanel.setMode("attached");
        return;
      }
      input.layout.setRegionVisible(region, open);
    },

    setRegionSize(region, size) {
      requireAction(region, "resize");
      const bounds = input.layout.getRegionSize(region);
      input.layout.setRegionSize(region, Math.min(bounds?.maxPx ?? Infinity, Math.max(bounds?.minPx ?? 0, size)));
    },

    getSidePanelPresentation: input.sidePanel.getMode,
    setSidePanelPresentation(presentation) {
      if (presentation === "floating" && input.layout.getRegionSettings("side")?.floatable === false)
        throw new Error("Panel cannot float: side");
      if (presentation === "closed") requireAction("side", "close");
      else if (!input.getPolicy("side").open) requireAction("side", "open");
      input.sidePanel.setMode(presentation);
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
