import { ThemePreferenceProvider } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import { DesktopQuitConfirmationDialog } from "./desktop-quit-confirmation";

const meta = {
  title: "Desktop/QuitConfirmation",
  component: DesktopQuitConfirmationDialog,
  parameters: { layout: "fullscreen" },
  args: {
    activity: {
      sessions: [{ id: "session-one", label: "PS-217 implementation" }],
      terminals: [{ id: "terminal-one", label: "Desktop tests" }],
      jobs: [{ id: "job-one", label: "Package verification" }],
    },
    onKeepOpen: fn(),
    onQuit: fn(),
  },
  play: async ({ args }) => {
    const dialog = await screen.findByRole("alertdialog", { name: "Active work is still running" });
    // The dialog fades in after it mounts.
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(screen.getByRole("button", { name: "Keep Prompt Studio open" })).toHaveFocus();
    await userEvent.tab();
    await expect(screen.getByRole("button", { name: "Cancel work and quit" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect(args.onKeepOpen).toHaveBeenCalledOnce();
    await expect(args.onQuit).not.toHaveBeenCalled();
  },
} satisfies Meta<typeof DesktopQuitConfirmationDialog>;

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

export const OneTerminal: Story = {
  args: { activity: { sessions: [], terminals: [{ id: "terminal-one", label: "sleep 300" }], jobs: [] } },
  decorators: Light.decorators,
};
