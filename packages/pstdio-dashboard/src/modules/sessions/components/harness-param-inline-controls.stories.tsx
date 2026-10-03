import { Flex } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { HarnessParamInlineControls } from "./harness-param-inline-controls";
import type { HarnessParamValues } from "./harness-param-values";

const meta = {
  title: "Sessions/Harness Inline Controls",
  component: HarnessParamInlineControls,
  args: {
    schema: {
      effort: {
        type: "select",
        label: "Reasoning effort",
        defaultValue: "medium",
        options: [
          { label: "None", value: "none", icon: "CircleSlash" },
          { label: "Minimal", value: "minimal", icon: "level-low" },
          { label: "Low", value: "low", icon: "level-low" },
          { label: "Medium", value: "medium", icon: "level-mid" },
          { label: "High", value: "high", icon: "level-high" },
          { label: "Extra high", value: "xhigh", icon: "level-xhigh" },
          { label: "Max", value: "max", icon: "flame" },
        ],
      },
    },
    overrides: {},
    onOverridesChange: () => {},
  },
  render: (props) => {
    const [overrides, setOverrides] = useState<HarnessParamValues>(props.overrides);
    return <HarnessParamInlineControls {...props} overrides={overrides} onOverridesChange={setOverrides} />;
  },
} satisfies Meta<typeof HarnessParamInlineControls>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EffortLevels: Story = {};
export const RememberedEffort: Story = {
  args: { overrides: { effort: "high" } },
};
export const CommandOwnedPlan: Story = {
  args: {
    schema: {
      ...meta.args.schema,
      collaboration: {
        type: "select",
        control: "command",
        defaultValue: "plan",
        options: [
          { label: "Default", value: "default" },
          { label: "Plan", value: "plan" },
        ],
      },
    },
  },
};
export const LevelColors: Story = {
  render: (props) => (
    <Flex gap="4" wrap="wrap">
      {meta.args.schema.effort.options.map((option) => (
        <HarnessParamInlineControls key={option.value} {...props} overrides={{ effort: option.value }} />
      ))}
    </Flex>
  ),
};
export const ChangeEffort: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Reasoning effort: Medium" }));
    await userEvent.click(page.getByRole("menuitemradio", { name: "Extra high" }));
    await expect(canvas.getByRole("button", { name: "Reasoning effort: Extra high" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reasoning effort: Extra high" }));
    await expect(page.getByRole("menuitemradio", { name: "Extra high" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(page.getByRole("menuitemradio", { name: "Medium" }));
    await expect(canvas.getByRole("button", { name: "Reasoning effort: Medium" })).toBeVisible();
  },
};
export const ChangeEffortWithKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Reasoning effort: Medium" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(page.getByRole("menu")).toHaveFocus());
    await userEvent.keyboard("{End}{Enter}");
    await expect(canvas.getByRole("button", { name: "Reasoning effort: Max" })).toBeVisible();
  },
};
export const Disabled: Story = { args: { disabled: true } };
