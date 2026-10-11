import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { buildPlan } from "../model/build-plan";
import { PlanGraph } from "./plan-graph";
import { useViewSections } from "./plan-state";

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

function TimelineGraphStory(props: { filtered?: boolean }) {
  const { filtered } = props;
  const { sections, tracks, toggle } = useViewSections(plan, new Set(filtered ? ["preview"] : ["preview", "launch"]));
  return (
    <Box h="600px">
      <PlanGraph
        sections={sections}
        tracks={tracks}
        today={plan.today}
        squareArrows
        relations={new Map()}
        onToggle={toggle}
        onContext={() => {}}
        onSelect={() => {}}
        onDragStart={() => {}}
        onDragTarget={() => {}}
        onDrop={() => {}}
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
