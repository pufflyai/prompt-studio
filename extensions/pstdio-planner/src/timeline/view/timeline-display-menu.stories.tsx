import type { Meta, StoryObj } from "@storybook/react";
import { TimelineDisplayMenu } from "./timeline-display-menu";

const meta: Meta<typeof TimelineDisplayMenu> = {
  title: "Extensions/Planner/Timeline display",
  component: TimelineDisplayMenu,
  args: {
    storageKey: "timeline-display-story",
    attributes: [
      { id: "id", label: "ID", type: { kind: "string" }, displayable: true },
      { id: "status", label: "Status", type: { kind: "enum", options: [] }, displayable: true },
      { id: "priority", label: "Priority", type: { kind: "enum", options: [] }, displayable: true },
      { id: "type", label: "Type", type: { kind: "enum", options: [] }, displayable: true },
      { id: "track", label: "Track", type: { kind: "enum", options: [] }, displayable: true },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof TimelineDisplayMenu>;
export const Properties: Story = {};
