import { defaultThemePreferences, ThemePreferenceProvider } from "@pstdio/ui";
import { createWorkbench } from "@pstdio/workbench";
import { openRelatedResourcesPreference } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
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
} satisfies Meta<typeof AppearanceExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const RelatedResourcePreference: Story = {
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole("checkbox", { name: "Open related resources" });
    await expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await expect(toggle).not.toBeChecked();
  },
};
