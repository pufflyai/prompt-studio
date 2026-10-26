import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ExtensionExecutionControls } from "./extension-execution-controls";

const meta = {
  title: "Settings/ExtensionExecution",
  component: ExtensionExecutionControls,
  args: {
    execution: {
      available: true,
      stopped: false,
      owners: [{ state: "ready", pendingCalls: 1 }],
      affectedProjects: [
        { id: "first", name: "First" },
        { id: "second", name: "Second" },
      ],
    },
    onAction: fn(async () => {}),
  },
} satisfies Meta<typeof ExtensionExecutionControls>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SharedSource: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Stop" }));
    await expect(canvas.getByText(/First, Second/)).toBeVisible();
    await expect(args.onAction).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(args.onAction).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Stop" }));
    await userEvent.click(canvas.getByRole("button", { name: "Stop extension" }));
    await expect(args.onAction).toHaveBeenCalledWith("stop");
  },
};

export const Stopped: Story = {
  args: { execution: { ...meta.args.execution, stopped: true, owners: [{ state: "stopped", pendingCalls: 0 }] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Stop" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Restart" }));
    await expect(canvas.getByText(/First, Second/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Restart extension" }));
    await expect(args.onAction).toHaveBeenCalledWith("restart");
  },
};

export const FailedRecovery: Story = {
  args: { error: "The backend connection was interrupted. Check the extension state before trying again." },
};
