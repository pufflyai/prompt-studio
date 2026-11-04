import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { defaultThemePreferences, ThemePreferenceProvider } from "@pstdio/ui";
import { createWorkbench } from "@pstdio/workbench";
import { openRelatedResourcesPreference } from "@pstdio/workbench/react";
import { useState } from "react";
import { CustomizationsSettingsContent } from "./customizations-settings-panel";

const themePreferences = [
  ...defaultThemePreferences,
  { id: "lab.paper", title: "Paper", mode: "light" as const },
  { id: "lab.ember", title: "Ember", mode: "dark" as const },
];
const Example = () => {
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    workbench.preferences.registerSchema({
      properties: { [openRelatedResourcesPreference]: { type: "boolean", scope: "user", default: true } },
    });
    return workbench;
  });
  return <CustomizationsSettingsContent workbench={workbench} />;
};

const meta = {
  title: "Settings/Customizations",
  component: Example,
  decorators: [
    (Story) => (
      <ThemePreferenceProvider initialPreference="pstdio-dark" themePreferences={themePreferences}>
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
} satisfies CanvasMeta<typeof Example>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Default: Story = { id: "settings-customizations--default" };
