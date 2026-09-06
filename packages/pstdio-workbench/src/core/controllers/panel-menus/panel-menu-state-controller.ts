import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import { runWorkbenchEffect } from "../../shared/workbench-effect";

export interface WorkbenchPanelMenuState {
  openByMenuId: Record<string, boolean>;
}

export interface PersistedWorkbenchPanelMenuState {
  openByMenuId: Record<string, boolean>;
}

export interface WorkbenchPanelMenuStatePersistenceAdapter {
  getMenuStates(scope?: string): PersistedWorkbenchPanelMenuState | undefined;
  setMenuStates(state: PersistedWorkbenchPanelMenuState, scope?: string): void;
}

export type WorkbenchPanelMenuStateChangeListener = (state: WorkbenchPanelMenuState) => void;

export interface WorkbenchPanelMenuStateController {
  store: WorkbenchStore<WorkbenchPanelMenuState>;
  isOpen(menuId: string): boolean;
  setOpen(menuId: string, open: boolean): void;
  toggle(menuId: string): void;
  setPersistenceScope(scope: string | undefined): void;
  getPersistenceScope(): string | undefined;
  onDidChange(listener: WorkbenchPanelMenuStateChangeListener): Disposable;
}

export interface CreateWorkbenchPanelMenuStateControllerInput {
  persistence?: WorkbenchPanelMenuStatePersistenceAdapter;
}

export const createWorkbenchPanelMenuStateController = (
  input: CreateWorkbenchPanelMenuStateControllerInput = {},
): WorkbenchPanelMenuStateController => {
  let currentScope: string | undefined;
  const persisted = runWorkbenchEffect(`panel menu cache read for ${currentScope ?? "unscoped"}`, () =>
    input.persistence?.getMenuStates(currentScope),
  );
  const resolveOpenByMenuId = (state: PersistedWorkbenchPanelMenuState | undefined) => ({
    ...state?.openByMenuId,
  });

  const store = createWorkbenchStore<WorkbenchPanelMenuState>({
    name: "workbench.panelMenuState",
    initialState: { openByMenuId: resolveOpenByMenuId(persisted) },
  });

  const persistState = () => {
    if (!input.persistence) return;
    runWorkbenchEffect(`panel menu cache write for ${currentScope ?? "unscoped"}`, () =>
      input.persistence?.setMenuStates({ openByMenuId: store.getState().openByMenuId }, currentScope),
    );
  };

  const isOpen = (menuId: string) => store.getState().openByMenuId[menuId] ?? true;

  return {
    store,

    isOpen,

    setOpen(menuId, open) {
      const snapshot = store.getState();
      if ((snapshot.openByMenuId[menuId] ?? true) === open) return;
      store.setState(
        {
          openByMenuId: { ...snapshot.openByMenuId, [menuId]: open },
        },
        false,
        "setMenuOpen",
      );
      persistState();
    },

    toggle(menuId) {
      this.setOpen(menuId, !isOpen(menuId));
    },

    setPersistenceScope(scope) {
      if (scope === currentScope) return;
      persistState();
      currentScope = scope;
      const incoming = runWorkbenchEffect(`panel menu cache read for ${currentScope ?? "unscoped"}`, () =>
        input.persistence?.getMenuStates(currentScope),
      );
      store.setState({ openByMenuId: resolveOpenByMenuId(incoming) }, false, "setPersistenceScope");
    },

    getPersistenceScope: () => currentScope,

    onDidChange(listener) {
      const unsubscribe = store.subscribe((state) => listener(state));
      return createDisposable(unsubscribe);
    },
  };
};
