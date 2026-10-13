import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchSidePanelMode } from "../../registries/layout/layout-types";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type { WorkbenchPanelPolicy } from "../shell/panel-policy";

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
  getPolicy?(): WorkbenchPanelPolicy;
  setPresentation?(mode: WorkbenchSidePanelMode): void | Promise<void>;
}

// The layout's side region owns the mode, so it follows layout persistence scopes
// like every other region. The controller only applies the floating policy.
export const createWorkbenchSidePanelController = (input: CreateWorkbenchSidePanelControllerInput) => {
  const canFloat = () => input.getFloatingPanels?.() !== "hidden";
  const resolveMode = (mode: WorkbenchSidePanelMode) => (!canFloat() && mode === "floating" ? "attached" : mode);
  const defaultPresentation = input.initialMode === "attached" ? "attached" : "floating";
  const getMode = () => {
    const side = input.layout.getLayout().regions.side;
    return (input.getPolicy?.().open ?? side.visible)
      ? resolveMode(side.presentation ?? defaultPresentation)
      : "closed";
  };

  return {
    canFloat,
    getMode,
    setMode: (mode: WorkbenchSidePanelMode) => {
      if (input.setPresentation) return input.setPresentation(mode);
      const policy = input.getPolicy?.();
      if (mode === "closed") {
        if (policy && !policy.canClose) throw new Error("Panel cannot close: side");
      } else if (policy && !policy.open) {
        if (!policy.canOpen) throw new Error("Panel cannot open: side");
        input.layout.setSidePanelMode(resolveMode(mode));
        return;
      }
      input.layout.setSidePanelMode(resolveMode(mode));
    },
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
