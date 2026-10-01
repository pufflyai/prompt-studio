import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchSidePanelMode } from "../../registries/layout/layout-types";
import { createDisposable, type Disposable } from "../../shared/disposable";

export type { WorkbenchSidePanelMode };

export type WorkbenchSidePanelChangeListener = (mode: WorkbenchSidePanelMode) => void;

export interface WorkbenchSidePanelController {
  canFloat(): boolean;
  getMode(): WorkbenchSidePanelMode;
  setMode(mode: WorkbenchSidePanelMode): void;
  onDidChange(listener: WorkbenchSidePanelChangeListener): Disposable;
}

export interface CreateWorkbenchSidePanelControllerInput {
  layout: Pick<LayoutModel, "getLayout" | "setSidePanelMode" | "store">;
  getFloatingPanels?(): "visible" | "hidden";
  onDidChangePolicy?(listener: () => void): Disposable;
  initialMode?: WorkbenchSidePanelMode;
}

// The layout's side region owns the mode, so it follows layout persistence scopes
// like every other region. The controller only applies the floating policy.
export const createWorkbenchSidePanelController = (input: CreateWorkbenchSidePanelControllerInput) => {
  const canFloat = () => input.getFloatingPanels?.() !== "hidden";
  const resolveMode = (mode: WorkbenchSidePanelMode) => (!canFloat() && mode === "floating" ? "attached" : mode);
  const defaultPresentation = input.initialMode === "attached" ? "attached" : "floating";
  const getMode = () => {
    const side = input.layout.getLayout().regions.side;
    return side.visible ? resolveMode(side.presentation ?? defaultPresentation) : "closed";
  };

  return {
    canFloat,
    getMode,
    setMode: (mode: WorkbenchSidePanelMode) => input.layout.setSidePanelMode(resolveMode(mode)),
    onDidChange(listener: WorkbenchSidePanelChangeListener) {
      let current = getMode();
      const notify = () => {
        const next = getMode();
        if (next === current) return;
        current = next;
        listener(next);
      };
      const unsubscribe = input.layout.store.subscribe(notify);
      const policy = input.onDidChangePolicy?.(notify);
      return createDisposable(() => {
        unsubscribe();
        policy?.dispose();
      });
    },
  };
};
