import type { Meta, StoryObj } from "@storybook/react";

import { AppShell } from "./app-shell";

const meta: Meta = {
  title: "Foundations/App Shell",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <AppShell />,
};
