import type { CanvasMeta } from "@pstdio/canvas";
import { WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { SettingsDesign } from "./settings-overlay";

const themeStorage = { getItem: () => null, setItem: () => {} };

export default {
  title: "Proposals/Settings consistency",
  component: SettingsDesign,
  fullscreen: true,
  defaultTheme: "pstdio-light",
  decorators: [
    (Frame, { theme }) => (
      <WorkbenchThemeProvider defaultThemePreference={theme.id} themePreferences={[theme]} themeStorage={themeStorage}>
        <Frame />
      </WorkbenchThemeProvider>
    ),
  ],
  description:
    "One settings layout using the real parameter editor and workbench navigation. All values are synthetic and stay in this preview. Runtime and project name retain explicit save actions.",
} satisfies CanvasMeta<typeof SettingsDesign>;

export const Settings = { args: { initialPage: "runtime" }, defaultTheme: "pstdio-light" };
export const NavigationLoading = {
  args: { navState: "loading" },
  description: "Navigation is loading while the current settings page remains usable.",
};
export const ContentLoading = {
  args: { state: "loading" },
  description: "The selected page is loading; navigation stays available.",
};
export const NavigationAndContentLoading = {
  args: { navState: "loading", state: "loading" },
  description: "Initial load of both settings navigation and page content.",
};
