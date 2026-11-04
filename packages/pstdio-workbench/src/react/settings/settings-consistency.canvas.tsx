import type { CanvasMeta } from "@pstdio/canvas";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { SettingsPreview } from "./settings-preview";

const themeStorage = { getItem: () => null, setItem: () => {} };
export default {
  title: "Settings/Consistent settings",
  component: SettingsPreview,
  fullscreen: true,
  description:
    "Production settings shell, navigation, fixed-height header with Reset/Save icon buttons shown only for unsaved edits, leave warning and skeletons. Preview values stay in local state.",
  decorators: [
    (Frame, { theme }) => (
      <WorkbenchThemeProvider defaultThemePreference={theme.id} themePreferences={[theme]} themeStorage={themeStorage}>
        <Frame />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof SettingsPreview>;
export const Settings = {};
export const NavigationLoading = { args: { navigationLoading: true } };
export const ContentLoading = { args: { contentLoading: true } };
export const NavigationAndContentLoading = { args: { navigationLoading: true, contentLoading: true } };
