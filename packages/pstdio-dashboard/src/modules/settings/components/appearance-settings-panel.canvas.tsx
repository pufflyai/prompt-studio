import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { defaultThemePreferences, ThemePreferenceProvider } from "@pstdio/ui";
import { createWorkbench } from "@pstdio/workbench";
import { openRelatedResourcesPreference } from "@pstdio/workbench/react";
import { AppearanceSettingsPanel } from "./appearance-settings-panel";

const themePreferences = [
  ...defaultThemePreferences,
  { id: "lab.paper", title: "Paper", mode: "light" as const },
  { id: "lab.ember", title: "Ember", mode: "dark" as const },
];
const AppearanceExample = () => {
  const workbench = createWorkbench();
  workbench.preferences.registerSchema({
    properties: { [openRelatedResourcesPreference]: { type: "boolean", scope: "user", default: true } },
  });
  return <AppearanceSettingsPanel workbench={workbench} />;
};
const meta = {
  title: "Settings/Appearance",
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
};
export const RelatedResourcePreference: Story = {
  id: "settings-appearance--related-resource-preference",
};
