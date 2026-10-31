import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { TimelineDisplayMenu } from "./timeline-display-menu";
import { TimelinePresentationProvider } from "./timeline-presentation";

const meta: CanvasMeta<typeof TimelineDisplayMenu> = {
  title: "Extensions/Planner/Timeline display",
  component: TimelineDisplayMenu,
  decorators: [
    (Story) => (
      <TimelinePresentationProvider projectId="timeline-display-story">
        <Story />
      </TimelinePresentationProvider>
    ),
  ],
  args: {
    storageKey: "timeline-display-story",
    attributes: [
      { id: "id", label: "ID", type: { kind: "string" }, displayable: true },
      { id: "status", label: "Status", type: { kind: "enum", options: [] }, displayable: true },
      { id: "needsAttention", label: "Needs attention", type: { kind: "enum", options: [] }, displayable: true },
      { id: "priority", label: "Priority", type: { kind: "enum", options: [] }, displayable: true },
      { id: "type", label: "Type", type: { kind: "enum", options: [] }, displayable: true },
      { id: "track", label: "Track", type: { kind: "enum", options: [] }, displayable: true },
    ],
  },
};
export default meta;
type Story = CanvasFrame<typeof TimelineDisplayMenu>;
export const Properties: Story = {
  id: "extensions-planner-timeline-display--properties",
};
