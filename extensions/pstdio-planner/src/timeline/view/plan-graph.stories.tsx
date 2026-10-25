import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
import { buildPlan } from "../model/build-plan";
import { buildTracks } from "../model/tracks";
import type { DropTarget } from "./drag";
import { PlanGraph } from "./plan-graph";
import { useDragAndDrop, useViewSections } from "./plan-state";
import { TimelinePresentationProvider } from "./timeline-presentation";
import type { PlanClient } from "./use-plan";

const plan = buildPlan({
  statuses: [],
  tags: [],
  today: "2026-10-10",
  tickets: ["preview", "launch"].map((id) => ({
    id,
    shorthand: id === "preview" ? "P-1" : "P-2",
    title: id === "preview" ? "Preview work" : "Launch work",
    content: "",
    statusId: null,
  })),
  plan: {
    deadlines: [
      { id: "preview", date: "2026-10-15", name: "Preview" },
      { id: "launch", date: "2026-10-22", name: "Launch" },
      { id: "empty", date: "2026-10-29", name: "Empty placement target" },
    ],
    order: [
      { ticketId: "preview", deadlineId: "preview" },
      { ticketId: "launch", deadlineId: "launch" },
    ],
  },
});

const densePlan = buildPlan({
  statuses: [],
  tags: [],
  today: "2026-10-10",
  tickets: Array.from({ length: 1000 }, (_, index) => ({
    id: String(index),
    shorthand: `P-${index + 1}`,
    title: index % 7 === 0 ? "A long work item title that wraps across several lines of the shared card" : "Work item",
    content: "",
    statusId: null,
    dependsOn: index ? [String(index - 1)] : [],
  })),
  plan: {
    deadlines: [],
    order: Array.from({ length: 1000 }, (_, index) => ({ ticketId: String(index), deadlineId: null })),
  },
});

// Drops only reset the preview here; the story has no plan to move tickets in.
const storyClient = {
  commands: { "timeline.track.assign": async () => {}, "timeline.plan.move": async () => {} },
} as unknown as PlanClient;

function TimelineGraphStory(props: {
  dense?: boolean;
  filtered?: boolean;
  preview?: { dragId: string; dropTarget: DropTarget };
}) {
  const { dense, filtered, preview } = props;
  const shown = dense ? densePlan : plan;
  const ids = shown.sections.flatMap(({ rows }) => rows.map(({ id }) => id));
  const { sections, toggle } = useViewSections(shown, new Set(filtered ? ["preview"] : ids));
  const drag = useDragAndDrop(storyClient);
  const tracks = buildTracks(
    shown.trackProperty,
    shown.sections.flatMap(({ rows }) => rows),
  );
  return (
    <Box h="600px">
      <PlanGraph
        sections={sections}
        tracks={tracks}
        today={plan.today}
        relations={new Map()}
        dragId={preview?.dragId ?? drag.dragId}
        dropTarget={preview?.dropTarget ?? drag.dropTarget}
        onToggle={toggle}
        onContext={() => {}}
        onSelect={() => {}}
        onDragStart={drag.setDragId}
        onDragTarget={drag.setDropTarget}
        onDrop={() => void drag.drop()}
        onDelete={() => {}}
        onRenameDeadline={async () => {}}
        onRedate={async () => {}}
        onRenameTrack={async () => {}}
        onReview={() => {}}
        onNewTrack={() => {}}
        onCreateDeadline={() => {}}
      />
    </Box>
  );
}

const meta: Meta<typeof TimelineGraphStory> = {
  title: "Extensions/Planner/Timeline graph",
  component: TimelineGraphStory,
  decorators: [
    (Story) => (
      <TimelinePresentationProvider projectId="graph-story">
        <Story />
      </TimelinePresentationProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof TimelineGraphStory>;
export const AllMilestones: Story = {};
export const LargePlan: Story = { args: { dense: true } };
export const FilteredMilestone: Story = { args: { filtered: true } };
export const DropPreview: Story = {
  args: { preview: { dragId: "launch", dropTarget: { deadlineId: "preview", beforeId: "preview", trackId: null } } },
};
export const DropOnEmptyMilestone: Story = {
  args: { preview: { dragId: "launch", dropTarget: { deadlineId: "empty" } } },
};
// Panning focuses the canvas for arrow keys without drawing a keyboard focus ring.
export const PanWithoutFocusRing: Story = {
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>("[data-timeline-viewport]");
    await expect(viewport).not.toBeNull();
    const { left, top } = viewport!.getBoundingClientRect();
    const point = { pointerId: 1, button: 0, bubbles: true, clientX: left + 600, clientY: top + 400 };
    viewport!.dispatchEvent(new PointerEvent("pointerdown", point));
    viewport!.dispatchEvent(new PointerEvent("pointermove", { ...point, clientX: point.clientX - 40 }));
    viewport!.dispatchEvent(new PointerEvent("pointerup", point));
    await expect(viewport).toHaveFocus();
    await expect(viewport!.matches(":focus-visible")).toBe(false);
  },
};
