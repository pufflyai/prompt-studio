import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type BuiltInWorkbenchThemeId = "light" | "dark" | "highContrast";
export type WorkbenchThemeId = BuiltInWorkbenchThemeId | (string & {});

export interface WorkbenchThemeTokens {
  activityBarBackground: string;
  sideBarBackground: string;
  mainBackground: string;
  panelBackground: string;
  statusBarBackground: string;
  focusBorder: string;
  commandPaletteBackground: string;
}

export interface WorkbenchTheme {
  id: WorkbenchThemeId;
  tokens: WorkbenchThemeTokens;
}

export interface WorkbenchThemeState {
  theme: WorkbenchTheme;
  themes: Record<string, WorkbenchTheme>;
}

export interface WorkbenchThemeController {
  store: WorkbenchStore<WorkbenchThemeState>;
  getTheme(): WorkbenchTheme;
  setTheme(id: WorkbenchThemeId): void;
  registerTheme(theme: WorkbenchTheme): Disposable;
  listThemes(): WorkbenchTheme[];
  setCustomTheme(theme: WorkbenchTheme): void;
  getCssVariables(): Record<string, string>;
}

export interface CreateWorkbenchThemeControllerInput {
  initialTheme?: BuiltInWorkbenchThemeId;
}

export const workbenchThemeCssVariableMap = {
  activityBarBackground: "--workbench-activity-bar-bg",
  sideBarBackground: "--workbench-sidebar-bg",
  mainBackground: "--workbench-main-bg",
  panelBackground: "--workbench-panel-bg",
  statusBarBackground: "--workbench-status-bar-bg",
  focusBorder: "--workbench-focus-border",
  commandPaletteBackground: "--workbench-command-palette-bg",
} as const satisfies Record<keyof WorkbenchThemeTokens, string>;

export const workbenchThemes = {
  light: {
    id: "light",
    tokens: {
      activityBarBackground: "var(--chakra-colors-bg-muted)",
      sideBarBackground: "var(--chakra-colors-bg-subtle)",
      mainBackground: "var(--chakra-colors-bg)",
      panelBackground: "var(--chakra-colors-bg-panel)",
      statusBarBackground: "var(--chakra-colors-bg-muted)",
      focusBorder: "var(--chakra-colors-color-palette-focus-ring)",
      commandPaletteBackground: "var(--chakra-colors-bg-panel)",
    },
  },
  dark: {
    id: "dark",
    tokens: {
      activityBarBackground: "var(--chakra-colors-bg-muted)",
      sideBarBackground: "var(--chakra-colors-bg-subtle)",
      mainBackground: "var(--chakra-colors-bg)",
      panelBackground: "var(--chakra-colors-bg-panel)",
      statusBarBackground: "var(--chakra-colors-bg-muted)",
      focusBorder: "var(--chakra-colors-color-palette-focus-ring)",
      commandPaletteBackground: "var(--chakra-colors-bg-panel)",
    },
  },
  highContrast: {
    id: "highContrast",
    tokens: {
      activityBarBackground: "Canvas",
      sideBarBackground: "Canvas",
      mainBackground: "Canvas",
      panelBackground: "Canvas",
      statusBarBackground: "Canvas",
      focusBorder: "Highlight",
      commandPaletteBackground: "Canvas",
    },
  },
} as const satisfies Record<BuiltInWorkbenchThemeId, WorkbenchTheme>;

const createCssVariables = (theme: WorkbenchTheme) =>
  Object.fromEntries(
    Object.entries(workbenchThemeCssVariableMap).map(([key, variable]) => [
      variable,
      theme.tokens[key as keyof WorkbenchThemeTokens],
    ]),
  );

export const createWorkbenchThemeController = (
  input: CreateWorkbenchThemeControllerInput = {},
): WorkbenchThemeController => {
  const store = createWorkbenchStore<WorkbenchThemeState>({
    name: "workbench.theme",
    initialState: { theme: workbenchThemes[input.initialTheme ?? "light"], themes: { ...workbenchThemes } },
  });

  return {
    store,

    getTheme() {
      return store.getState().theme;
    },

    setTheme(id) {
      const snapshot = store.getState();
      const theme = snapshot.themes[id];
      if (!theme) throw new Error(`Workbench theme not registered: ${id}`);
      if (snapshot.theme.id === id) return;
      store.setState({ ...snapshot, theme }, false, "setWorkbenchTheme");
    },

    registerTheme(theme) {
      const snapshot = store.getState();
      if (snapshot.themes[theme.id]) throw new Error(`Workbench theme already registered: ${theme.id}`);

      store.setState(
        { ...snapshot, themes: { ...snapshot.themes, [theme.id]: theme } },
        false,
        "registerWorkbenchTheme",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.themes[theme.id] !== theme) return;
        const { [theme.id]: _removed, ...themes } = current.themes;
        store.setState(
          { themes, theme: current.theme.id === theme.id ? themes.light : current.theme },
          false,
          "unregisterWorkbenchTheme",
        );
      });
    },

    listThemes() {
      return Object.values(store.getState().themes);
    },

    setCustomTheme(theme) {
      store.setState({ ...store.getState(), theme }, false, "setCustomWorkbenchTheme");
    },

    getCssVariables() {
      return createCssVariables(store.getState().theme);
    },
  };
};
