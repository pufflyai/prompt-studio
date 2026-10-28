import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ActionInput } from "./action-input";

const run = { id: "run", name: "Run" };
const meta = {
  title: "Patterns/Param Editor/Actions",
  component: ActionInput,
  args: {
    id: "action",
    name: "Action",
    defaultValue: "run",
    options: [run],
    presentation: "horizontal",
    onChange: fn(),
  },
} satisfies Meta<typeof ActionInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RepeatSelectedAction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    for (let count = 1; count <= 2; count++) {
      await userEvent.click(canvas.getByRole("button", { name: "Run" }));
      await userEvent.click(page.getByRole("menuitemradio", { name: "Run" }));
      await expect(args.onChange).toHaveBeenCalledTimes(count);
      await expect(args.onChange).toHaveBeenLastCalledWith("action", "run");
    }
  },
};
export const OnlyActiveActionEnabled: Story = {
  args: { options: [run, { id: "stop", name: "Stop", disabled: true }] },
  play: RepeatSelectedAction.play,
};
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Run" })).toBeDisabled();
  },
};
export const NoEnabledActions: Story = {
  args: { options: [{ ...run, disabled: true }] },
  play: ReadOnly.play,
};
