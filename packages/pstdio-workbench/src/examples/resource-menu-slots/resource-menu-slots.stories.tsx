import type { Meta, StoryObj } from "@storybook/react";
import { ResourceMenuSlotsExample } from "./module";

const meta = {
  title: "pstdio-workbench/Examples/Resource menu slots",
  component: ResourceMenuSlotsExample,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResourceMenuSlotsExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoResourceKinds: Story = {};
