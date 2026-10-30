import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ThemePreferenceProvider } from "@pstdio/ui";
import { DesktopQuitConfirmationDialog } from "./desktop-quit-confirmation";

const meta = {
  title: "Desktop/QuitConfirmation",
  component: DesktopQuitConfirmationDialog,
  parameters: { layout: "fullscreen" },
  args: {
    activity: {
      sessions: [{ id: "session-one", label: "Improve the quit warning" }],
      terminals: [{ id: "terminal-one", label: "Desktop tests" }],
      jobs: [
        { id: "job-one", label: "Check merged pull requests", description: "Prompt Studio" },
        { id: "job-two", label: "Auto build", description: "Website" },
      ],
    },
    onKeepOpen: () => {},
    onQuit: () => {},
  },
} satisfies CanvasMeta<typeof DesktopQuitConfirmationDialog>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Light: Story = {
  id: "desktop-quitconfirmation--light",
  decorators: [
    (Story) => (
      <ThemePreferenceProvider key="pstdio-light" initialPreference="pstdio-light">
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
};
export const Dark: Story = {
  id: "desktop-quitconfirmation--dark",
  decorators: [
    (Story) => (
      <ThemePreferenceProvider key="pstdio-dark" initialPreference="pstdio-dark">
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
};
export const OneTerminal: Story = {
  id: "desktop-quitconfirmation--one-terminal",
  args: { activity: { sessions: [], terminals: [{ id: "terminal-one", label: "sleep 300" }], jobs: [] } },
  decorators: Light.decorators,
};
export const LongContent: Story = {
  id: "desktop-quitconfirmation--long-content",
  decorators: Light.decorators,
  args: {
    activity: {
      sessions: Array.from({ length: 30 }, (_, index) => ({
        id: `session-${index}`,
        label: `Session ${index + 1}: ${"LongProjectAndTaskNameWithoutBreaks".repeat(7)}`,
      })),
      terminals: Array.from({ length: 20 }, (_, index) => ({
        id: `terminal-${index}`,
        label: `Terminal ${index + 1}`,
      })),
      jobs: [{ id: "background-check", label: "Check merged pull requests", description: "Prompt Studio" }],
    },
  },
};
