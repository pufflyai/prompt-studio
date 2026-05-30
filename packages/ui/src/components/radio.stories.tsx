import { Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { Radio, RadioGroup } from "./radio";

const meta = {
  title: "Components/Inputs/Radio",
  component: Radio,
  decorators: [
    (Story: () => ReactNode) => (
      <div style={{ padding: "24px", width: "320px" }}>
        <RadioGroup defaultValue="selected">
          <Story />
        </RadioGroup>
      </div>
    ),
  ],
} satisfies Meta<typeof Radio>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithLabel: Story = {
  args: {
    value: "selected",
    children: "Use project template",
  },
};

export const Disabled: Story = {
  args: {
    value: "disabled",
    disabled: true,
    children: "Unavailable",
  },
};

export const Options: Story = {
  args: {
    value: "selected",
  },
  render: () => (
    <Stack gap="sm">
      <Radio value="selected">TypeScript</Radio>
      <Radio value="python">Python</Radio>
      <Radio value="go">Go</Radio>
    </Stack>
  ),
};
