import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { defaultThemePreferences, ThemePreferenceProvider } from "@pstdio/ui";
import { createWorkbench } from "@pstdio/workbench";
import { openRelatedResourcesPreference } from "@pstdio/workbench/react";
import { useState } from "react";
import { AppearanceSettingsPanel } from "./appearance-settings-panel";

const themePreferences = [
  ...defaultThemePreferences,
  { id: "lab.paper", title: "Paper", mode: "light" as const },
  { id: "lab.ember", title: "Ember", mode: "dark" as const },
];
const AppearanceExample = () => {
  const [workbench] = useState(() => {
    const instance = createWorkbench();
    instance.preferences.registerSchema({
      properties: { [openRelatedResourcesPreference]: { type: "boolean", scope: "user", default: true } },
    });
    instance.layout.registerPanel({
      id: "appearance.inspector",
      title: "Inspector",
      region: "side",
      rendererId: "appearance.inspector",
      eligibleLocations: {},
    });
    return instance;
  });
  return <AppearanceSettingsPanel workbench={workbench} />;
};
const meta = {
  title: "Product/Settings/Appearance",
  component: AppearanceExample,
  decorators: [
    (Story) => (
      <ThemePreferenceProvider initialPreference="pstdio-dark" themePreferences={themePreferences}>
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
} satisfies CanvasMeta<typeof AppearanceExample>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Default: Story = {
  id: "settings-appearance--default",
  description: "Choose the default Side Panel and show or hide its bubble alongside the theme preferences.",
};
export const RelatedResourcePreference: Story = {
  id: "settings-appearance--related-resource-preference",
};
