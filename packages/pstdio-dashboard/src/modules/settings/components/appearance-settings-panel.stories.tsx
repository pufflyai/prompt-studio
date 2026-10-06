import { defaultThemePreferences, ThemePreferenceProvider } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { AppearanceSettingsPanel } from "./appearance-settings-panel";

const themePreferences = [
  ...defaultThemePreferences,
  { id: "lab.paper", title: "Paper", mode: "light" as const },
  { id: "lab.ember", title: "Ember", mode: "dark" as const },
];

const meta = {
  title: "Settings/Appearance",
  component: AppearanceSettingsPanel,
  decorators: [
    (Story) => (
      <ThemePreferenceProvider initialPreference="pstdio-dark" themePreferences={themePreferences}>
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
} satisfies Meta<typeof AppearanceSettingsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
