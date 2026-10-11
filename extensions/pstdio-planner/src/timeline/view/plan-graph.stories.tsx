import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
import { buildPlan } from "../model/build-plan";
import { buildTracks } from "../model/tracks";
import type { DropTarget } from "./drag";
import { PlanGraph } from "./plan-graph";
import { useDragAndDrop, useViewSections } from "./plan-state";
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

// Drops only reset the preview here; the story has no plan to move tickets in.
const storyClient = {
  commands: { "timeline.track.assign": async () => {}, "timeline.plan.move": async () => {} },
} as unknown as PlanClient;

function TimelineGraphStory(props: { filtered?: boolean; preview?: { dragId: string; dropTarget: DropTarget } }) {
  const { filtered, preview } = props;
  const { sections, toggle } = useViewSections(plan, new Set(filtered ? ["preview"] : ["preview", "launch"]));
  const drag = useDragAndDrop(storyClient, () => {});
  const tracks = buildTracks(
    plan.trackProperty,
    plan.sections.flatMap(({ rows }) => rows),
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
};
export default meta;
type Story = StoryObj<typeof TimelineGraphStory>;
export const AllMilestones: Story = {};
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
