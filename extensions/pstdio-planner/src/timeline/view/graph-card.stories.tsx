import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { PlanRow } from "../contracts";
import { ticketTarget } from "../planner";
import { GraphCard } from "./graph-card";

const row: PlanRow = {
  id: "shared-card",
  shorthand: "P-1",
  title: "Use the same card on both boards",
  status: { id: "todo", name: "Todo", icon: "circle", color: "gray" },
  state: "not-started",
  done: false,
  trackId: null,
  deadlineId: null,
  step: 1,
  ancestors: [],
  dependsOn: [],
  blocks: [],
  laterDependencies: [],
  flags: [],
  tagIds: [],
  requests: [],
  requestErrors: [],
  instructions: "",
  target: ticketTarget({ id: "shared-card", shorthand: "P-1", title: "Use the same card on both boards" }),
};
const meta: Meta<typeof GraphCard> = {
  title: "Extensions/Planner/Timeline card",
  component: GraphCard,
  decorators: [
    (Story) => (
      <Box position="relative" minH="300px">
        <Story />
      </Box>
    ),
  ],
  args: {
    row,
    x: 0,
    y: 0,
    dropBefore: false,
    onSelect: () => {},
    onDragStart: () => {},
    onDragOver: () => {},
    onDrop: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof GraphCard>;
export const Available: Story = {};
export const WaitingForPrerequisite: Story = {
  args: { row: { ...row, dependsOn: [{ id: "prerequisite", shorthand: "P-2", done: false }], flags: ["waiting"] } },
};
export const Blocked: Story = {
  args: { row: { ...row, state: "blocked", flags: ["blocked"], blockedReason: "Missing credentials" } },
};
export const Selected: Story = { args: { relation: "selected" } };
export const CustomStatus: Story = {
  args: { row: { ...row, status: { id: "queued", name: "Queued", icon: "flag", color: "purple" } } },
};
export const ReviewRequested: Story = { args: { row: { ...row, flags: ["human-needed"], state: "await-input" } } };
export const FullTitle: Story = {
  args: {
    row: {
      ...row,
      title:
        "A longer ticket title keeps the native Kanban card's wrapping and full height, so dependent cards and milestones stay below it.",
    },
  },
};
