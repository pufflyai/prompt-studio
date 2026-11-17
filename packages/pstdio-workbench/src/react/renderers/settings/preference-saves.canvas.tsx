import type { CanvasMeta } from "@pstdio/canvas";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { PreferenceSavePreview } from "./preference-save-preview";

const themeStorage = { getItem: () => null, setItem: () => {} };
export default {
  title: "Product/Workbench/Settings/Preference saves",
  component: PreferenceSavePreview,
  description:
    "PS-157: existing SettingsActions keep a visible draft while saving, show a failed save beside its recovery control, and preserve the draft when another source changes the accepted value.",
  decorators: [
    (Frame, { theme }) => (
      <WorkbenchThemeProvider defaultThemePreference={theme.id} themePreferences={[theme]} themeStorage={themeStorage}>
        <Frame />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof PreferenceSavePreview>;
export const Saves = {};
