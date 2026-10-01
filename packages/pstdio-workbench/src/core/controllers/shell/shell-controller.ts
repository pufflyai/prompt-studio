import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchRegion } from "../../registries/layout/layout-types";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type { WorkbenchSidePanelController, WorkbenchSidePanelMode } from "../side-panel/side-panel-controller";

export type WorkbenchSidePanelPresentation = WorkbenchSidePanelMode;

export type WorkbenchShellOpenRegion = "sidenav" | "secondary" | "side";

export interface WorkbenchShellRegionState {
  open: boolean;
  size?: number;
}

export interface WorkbenchShellController {
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
}): WorkbenchShellController => ({
  getRegionState(region) {
    const state = input.layout.getLayout().regions[region];
    return { open: state.visible, size: state.size };
  },

  setRegionOpen(region, open) {
    if (region === "side") {
      if (!open) input.sidePanel.setMode("closed");
      else if (input.sidePanel.getMode() === "closed") input.sidePanel.setMode("attached");
      return;
    }
    input.layout.setRegionVisible(region, open);
  },

  setRegionSize(region, size) {
    input.layout.setRegionSize(region, size);
  },

  getSidePanelPresentation: input.sidePanel.getMode,
  setSidePanelPresentation: input.sidePanel.setMode,

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
});
