import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { StatusRuleRow } from "./status-board-settings-panel";

const meta = {
  title: "pstdio-planner/Settings/Status board rules",
  component: StatusRuleRow,
  args: {
    status: {
      id: "backlog",
      name: "Backlog",
      color: "gray",
      icon: null,
      sortOrder: 0,
      isDefault: true,
      canCreate: true,
      canDragIn: true,
      canDragOut: false,
      columnActions: [],
    },
    t: (_key, fallback) => fallback ?? _key,
    onChange: fn(),
  },
} satisfies Meta<typeof StatusRuleRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EditableRules: Story = {};
