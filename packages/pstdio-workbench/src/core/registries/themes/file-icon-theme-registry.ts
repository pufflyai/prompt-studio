import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { FileIconThemePreferenceOption } from "./file-icon-theme-contracts";

export interface WorkbenchFileIconThemeStoreState {
  themes: readonly FileIconThemePreferenceOption[];
}

export interface FileIconThemeRegistry {
  store: WorkbenchStore<WorkbenchFileIconThemeStoreState>;
  register(themes: readonly FileIconThemePreferenceOption[]): Disposable;
  listThemes(): readonly FileIconThemePreferenceOption[];
}

export const createFileIconThemeRegistry = (): FileIconThemeRegistry => {
  const store = createWorkbenchStore<WorkbenchFileIconThemeStoreState>({
    name: "workbench.fileIconThemes",
    initialState: { themes: [] },
  });

  // Each registration owns its own group; the published list is every group
  // flattened in registration order.
  const groups = new Set<readonly FileIconThemePreferenceOption[]>();

  const sync = () => {
    store.setState({ themes: [...groups].flat() }, false, "syncFileIconThemes");
  };

  return {
    store,

    register(themes) {
      groups.add(themes);
      sync();
      return createDisposable(() => {
        if (groups.delete(themes)) sync();
      });
    },

    listThemes() {
      return store.getState().themes;
    },
  };
};
