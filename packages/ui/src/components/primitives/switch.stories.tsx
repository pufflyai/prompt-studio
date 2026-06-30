import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import { Switch } from "@/components/primitives/switch";

const meta = {
  title: "Components/Inputs/Switch",
  component: Switch,
  decorators: [
    (Story: () => ReactNode) => (
      <div style={{ padding: "24px", width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DefaultChecked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const WithLabel: Story = {
  args: {
    children: "Enable notifications",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Unavailable",
  },
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    defaultChecked: true,
    children: "Locked on",
  },
};

export const Sizes: Story = {
  render: () => (
    <Stack gap="md">
      <Switch size="sm">Small</Switch>
      <Switch size="md">Medium</Switch>
      <Switch size="lg">Large</Switch>
    </Stack>
  ),
};

export const WithTrackLabel: Story = {
  args: {
    trackLabel: { on: <Text fontSize="2xs">ON</Text>, off: <Text fontSize="2xs">OFF</Text> },
    size: "lg",
  },
};
