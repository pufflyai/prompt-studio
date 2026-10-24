import { Box } from "@chakra-ui/react";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent } from "storybook/test";
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

const meta: Meta<typeof MilestoneHeaderStory> = {
  title: "Extensions/Planner/Milestone header",
  component: MilestoneHeaderStory,
  args: { state: "forecast" },
};
export default meta;
type Story = StoryObj<typeof MilestoneHeaderStory>;
export const Forecast: Story = {
  play: async ({ canvas }) => {
    const estimate = canvas.getByLabelText("Milestone estimate");
    const progress = canvas.getByRole("progressbar", { name: "Milestone progress" });
    await expect(estimate).toHaveTextContent("ETA ~8h");
    await expect(estimate.getBoundingClientRect().right).toBeLessThanOrEqual(progress.getBoundingClientRect().left);
  },
};
export const Learning: Story = { args: { state: "learning" } };
export const Complete: Story = { args: { state: "complete" } };
export const Filtered: Story = {
  args: { visible: ["done", "open"] },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Milestone estimate")).toHaveTextContent("ETA ~6h");
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2");
    await expect(canvas.getByRole("button", { name: "Review 1 tickets that need a person in Preview" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Review 1 tickets that need a person in Preview" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Complex work · 1 tickets to review");
  },
};
export const Remaining: Story = {
  args: { visible: ["open"] },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Milestone estimate")).toHaveTextContent("ETA ~6h");
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1");
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    await expect(canvas.getByRole("button", { name: "Review 1 tickets that need a person in Preview" })).toBeVisible();
  },
};
export const CompletedOnly: Story = {
  args: { visible: ["done"] },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Milestone estimate")).toHaveTextContent("Done");
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1");
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    await expect(canvas.queryByRole("button", { name: /tickets that need a person/ })).toBeNull();
  },
};
export const Unstarted: Story = {
  args: { state: "unstarted" },
  play: async (context) => {
    await Forecast.play!(context);
    await expect(context.canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  },
};
