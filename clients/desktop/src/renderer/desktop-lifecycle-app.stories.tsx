import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { DesktopLifecycleView } from "./desktop-lifecycle-app";

const actions = {
  cancelQuit: async () => {},
  confirmQuit: async () => {},
  copyDiagnostics: async () => {},
  openLogs: async () => {},
  quitApp: async () => {},
  retryRuntime: async () => {},
};

const meta = {
  title: "Patterns/Desktop/Lifecycle",
  component: DesktopLifecycleView,
  parameters: { layout: "fullscreen" },
  args: { actions },
} satisfies Meta<typeof DesktopLifecycleView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StartingDiscovery: Story = {
  args: { state: { kind: "starting", phase: "discovery" } },
};

export const StartingRuntime: Story = {
  args: { state: { kind: "starting", phase: "spawning" } },
};

export const WaitingForWorkbench: Story = {
  args: { state: { kind: "starting", phase: "readiness" } },
};

export const Recovery: Story = {
  args: {
    state: {
      kind: "recovery",
      error: {
        code: "runtime_timeout",
        message: "The Prompt Studio runtime did not become ready in time.",
        actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
      },
    },
  },
};

export const ActiveWorkConfirmation: Story = {
  args: {
    state: {
      kind: "confirming_active_work",
      runtime: { instanceId: "runtime-one", origin: "http://127.0.0.1:43127", ownerType: "desktop" },
      activity: {
        sessions: [{ id: "session-one", label: "PS-217 implementation" }],
        terminals: [{ id: "terminal-one", label: "Desktop tests" }],
        jobs: [{ id: "job-one", label: "Package verification" }],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Keep Prompt Studio open" })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Cancel work and quit" })).toHaveFocus();
  },
};

export const Closing: Story = {
  args: { state: { kind: "closing" } },
};
