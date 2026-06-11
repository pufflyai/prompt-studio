import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { ThemePreferenceOption } from "./theme-contracts";

export interface WorkbenchThemeStoreState {
  themes: readonly ThemePreferenceOption[];
}

export interface ThemeRegistry {
  store: WorkbenchStore<WorkbenchThemeStoreState>;
  register(themes: readonly ThemePreferenceOption[]): Disposable;
  listThemes(): readonly ThemePreferenceOption[];
}

export const createThemeRegistry = (): ThemeRegistry => {
  const store = createWorkbenchStore<WorkbenchThemeStoreState>({
    name: "workbench.themes",
    initialState: { themes: [] },
  });

  // Each registration owns its own group; the published list is every group
  // flattened in registration order.
  const groups = new Set<readonly ThemePreferenceOption[]>();

  const sync = () => {
    store.setState({ themes: [...groups].flat() }, false, "syncThemes");
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
