import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchPanelMenuRegion, WorkbenchRegion } from "../../registries/layout/layout-types";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type { WorkbenchSidePanelController, WorkbenchSidePanelMode } from "../side-panel/side-panel-controller";

export type WorkbenchSidePanelPresentation = WorkbenchSidePanelMode;

export type WorkbenchShellOpenRegion = "sidenav" | "secondary" | WorkbenchPanelMenuRegion;

const shellOpenRegions = new Set<WorkbenchRegion>([
  "sidenav",
  "secondary",
  "main-left-menu",
  "main-right-menu",
  "secondary-left-menu",
  "secondary-right-menu",
  "side-left-menu",
  "side-right-menu",
]);

export const isWorkbenchShellOpenRegion = (region: WorkbenchRegion): region is WorkbenchShellOpenRegion =>
  shellOpenRegions.has(region);

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
    input.layout.setRegionVisible(region, open);
  },

  setRegionSize(region, size) {
    input.layout.setRegionSize(region, size);
  },

  getSidePanelPresentation: input.sidePanel.getMode,
  setSidePanelPresentation: input.sidePanel.setMode,

  onDidChange(listener) {
    const unsubscribeLayout = input.layout.store.subscribeSelector((state) => state.layout, listener);
    const sidePanelSubscription = input.sidePanel.onDidChange(listener);
    return createDisposable(() => {
      unsubscribeLayout();
      sidePanelSubscription.dispose();
    });
  },
});
