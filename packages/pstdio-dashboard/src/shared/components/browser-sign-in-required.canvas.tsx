import { ThemePreferenceProvider } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen } from "storybook/test";
import { BrowserSignInRequired } from "./browser-sign-in-required";

const meta = {
  title: "App/Browser sign-in required",
  component: BrowserSignInRequired,
  parameters: { layout: "fullscreen" },
  play: async () => {
    await expect(await screen.findByText("Open Prompt Studio from a terminal")).toBeVisible();
    await expect(screen.getByText("pst")).toBeVisible();
  },
} satisfies Meta<typeof BrowserSignInRequired>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  decorators: [
    (Story) => (
      <ThemePreferenceProvider key="pstdio-light" initialPreference="pstdio-light">
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
};

export const Dark: Story = {
  decorators: [
    (Story) => (
      <ThemePreferenceProvider key="pstdio-dark" initialPreference="pstdio-dark">
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
};
