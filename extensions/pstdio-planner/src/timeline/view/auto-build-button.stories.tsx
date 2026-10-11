import type { Meta, StoryObj } from "@storybook/react";
import { AutoBuildButton } from "./auto-build-button";

const meta: Meta<typeof AutoBuildButton> = {
  title: "Extensions/Planner/Auto Build Status",
  component: AutoBuildButton,
  args: {
    enabled: false,
    sessions: [],
    onConfigure: () => {},
    onTurnOff: async () => true,
    onOpenSession: () => {},
    t: (_key, fallback) => fallback ?? _key,
  },
};
export default meta;
type Story = StoryObj<typeof AutoBuildButton>;
export const Off: Story = {};
export const Waiting: Story = { args: { enabled: true } };
export const Running: Story = {
  args: {
    enabled: true,
    supervisor: { id: "supervisor", title: "Auto Build supervisor", status: "in_progress" },
    sessions: [{ id: "ticket", title: "Implement example ticket", status: "in_progress" }],
  },
};
export const Sleeping: Story = {
  args: { enabled: true, supervisor: { id: "supervisor", title: "Auto Build supervisor", status: "completed" } },
};
