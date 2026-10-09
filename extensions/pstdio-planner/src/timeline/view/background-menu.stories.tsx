import type { Meta, StoryObj } from "@storybook/react";
import { BackgroundMenu } from "./background-menu";

const meta: Meta<typeof BackgroundMenu> = {
  title: "Extensions/Planner/Timeline/Create Menu",
  component: BackgroundMenu,
};
export default meta;
type Story = StoryObj<typeof meta>;
export const TicketAndGate: Story = {
  args: { context: { x: 160, y: 160 }, onCreate: () => {}, onClose: () => {} },
};
