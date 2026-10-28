import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { DEFAULT_STATUSES, DEFAULT_TAGS } from "../../data/seed";
import { emptyWorkflowStatuses } from "../../data/workflow-statuses";
import { buildPlan } from "../model/build-plan";
import { buildTracks } from "../model/tracks";
import { useViewSections } from "./plan-state";
import { SectionHeader } from "./section-header";
import type { PlanClient } from "./use-plan";
import { usePlanActions } from "./use-plan-actions";

const host: GuestHost = {
  extensionId: "pstdio.pstdio-planner",
  call: async () => {
    throw new Error("This story does not run host commands.");
  },
  onEvent: () => () => {},
};
const client = createWebviewClient(host) as PlanClient;
function MilestoneHeaderStory(props: {
  state: "forecast" | "learning" | "complete" | "unstarted";
  visible?: string[];
}) {
  const { state, visible } = props;
  const plan = buildPlan({
    workflow: { ...emptyWorkflowStatuses(), completedStatusIds: ["done"] },
    today: "2026-10-13",
    now: Date.parse("2026-10-13T12:00:00Z"),
    statuses: DEFAULT_STATUSES,
    tags: DEFAULT_TAGS.map((seed) => seed()),
    attempts: [{ ticketId: "done", createdAt: "2026-10-13T10:00:00Z" }],
    requests: new Map(["open", "hidden"].map((id) => [id, { requests: [], errors: ["Unreadable request"] }])),
    tickets: [
      {
        id: "done",
        shorthand: "P-1",
        title: "Simple work",
        content: "",
        statusId: state === "learning" ? "ready" : "done",
        tags: { "default-complexity": "default-complexity-simple" },
      },
      {
        id: "open",
        shorthand: "P-2",
        title: "Complex work",
        content: "",
        statusId: state === "complete" ? "done" : "ready",
        tags: { "default-complexity": "default-complexity-complex" },
      },
      {
        id: "hidden",
        shorthand: "P-3",
        title: "Other work",
        content: "",
        statusId: state === "complete" ? "done" : "ready",
        tags: { "default-complexity": "default-complexity-simple" },
      },
    ],
    plan: {
      deadlines: [
        ...(state === "unstarted" ? [{ id: "previous", date: "2026-10-14" }] : []),
        { id: "preview", name: "Preview", date: "2026-10-15" },
      ],
      order: ["done", "open", "hidden"].map((ticketId) => ({
        ticketId,
        deadlineId: state === "unstarted" && ticketId === "done" ? "previous" : "preview",
      })),
    },
  });
  const { sections, toggle } = useViewSections(plan, new Set(visible ?? ["done", "open", "hidden"]));
  const { viewProps, selected, review } = usePlanActions({
    host,
    client,
    plan,
    sections,
    toggle,
    tracks: buildTracks(undefined, []),
  });
  return (
    <Box maxW="full" w="full" h="40px">
      <SectionHeader
        entry={sections.find(({ section }) => section.deadline?.id === "preview")!}
        onToggle={() => {}}
        onDelete={() => {}}
        onRenameDeadline={async () => {}}
        onReview={viewProps.onReview}
      />
      {selected ? (
        <Box role="status">
          {selected.title} · {review?.length} tickets to review
        </Box>
      ) : null}
    </Box>
  );
}
const meta: CanvasMeta<typeof MilestoneHeaderStory> = {
  title: "Extensions/Planner/Milestone header",
  component: MilestoneHeaderStory,
  args: { state: "forecast" },
};
export default meta;
type Story = CanvasVariant<typeof MilestoneHeaderStory>;
export const Forecast: Story = {
  id: "extensions-planner-milestone-header--forecast",
};
export const Learning: Story = {
  id: "extensions-planner-milestone-header--learning",
  args: { state: "learning" },
};
export const Complete: Story = {
  id: "extensions-planner-milestone-header--complete",
  args: { state: "complete" },
};
export const Filtered: Story = {
  id: "extensions-planner-milestone-header--filtered",
  args: { visible: ["done", "open"] },
};
export const Remaining: Story = {
  id: "extensions-planner-milestone-header--remaining",
  args: { visible: ["open"] },
};
export const CompletedOnly: Story = {
  id: "extensions-planner-milestone-header--completed-only",
  args: { visible: ["done"] },
};
export const Unstarted: Story = {
  id: "extensions-planner-milestone-header--unstarted",
  args: { state: "unstarted" },
};
