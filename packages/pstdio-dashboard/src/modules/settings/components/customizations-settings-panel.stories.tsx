import { defaultThemePreferences, ThemePreferenceProvider } from "@pstdio/ui";
import { createWorkbench } from "@pstdio/workbench";
import { openRelatedResourcesPreference } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { CustomizationsSettingsContent } from "./customizations-settings-panel";
import { OnboardingSettingsContent } from "./onboarding-settings-section";

const themePreferences = [
  ...defaultThemePreferences,
  { id: "lab.paper", title: "Paper", mode: "light" as const },
  { id: "lab.ember", title: "Ember", mode: "dark" as const },
];
const Example = (props: { initialHidden: boolean }) => {
  const { initialHidden } = props;
  const [hidden, setHidden] = useState(initialHidden);
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    workbench.preferences.registerSchema({
      properties: { [openRelatedResourcesPreference]: { type: "boolean", scope: "user", default: true } },
    });
    return workbench;
  });
  return (
    <CustomizationsSettingsContent
      workbench={workbench}
      onboarding={<OnboardingSettingsContent hidden={hidden} onChange={setHidden} />}
    />
  );
};
const meta = {
  title: "Settings/Customizations",
  component: Example,
  args: { initialHidden: false },
  decorators: [
    (Story) => (
      <ThemePreferenceProvider initialPreference="pstdio-dark" themePreferences={themePreferences}>
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Hidden: Story = { args: { initialHidden: true } };
export const Preferences: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const related = canvas.getByRole("checkbox", { name: "Open related resources" });
    await expect(related).toBeChecked();
    await userEvent.click(related);
    await expect(related).not.toBeChecked();
    const onboarding = canvas.getByRole("checkbox", { name: "Don’t show onboarding" });
    await expect(onboarding).not.toBeChecked();
    await userEvent.click(onboarding);
    await expect(onboarding).toBeChecked();
  },
};
