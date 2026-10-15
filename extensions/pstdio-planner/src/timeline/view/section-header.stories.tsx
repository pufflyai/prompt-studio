import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
import { DEFAULT_STATUSES, DEFAULT_TAGS } from "../../data/seed";
import { buildPlan } from "../model/build-plan";
import { SectionHeader } from "./section-header";

function MilestoneHeaderStory(props: { state: "forecast" | "learning" | "complete"; filtered?: boolean }) {
  const { state, filtered } = props;
  const plan = buildPlan({
    today: "2026-10-13",
    now: Date.parse("2026-10-13T12:00:00Z"),
    statuses: DEFAULT_STATUSES,
    tags: DEFAULT_TAGS.map((seed) => seed()),
    attempts: [{ ticketId: "done", createdAt: "2026-10-13T10:00:00Z" }],
    tickets: [
      {
        id: "done",
        shorthand: "P-1",
        title: "Simple work",
        content: "",
        statusId: state === "learning" ? "ready" : "done",
        tagIds: ["default-complexity-simple"],
      },
      {
        id: "open",
        shorthand: "P-2",
        title: "Complex work",
        content: "",
        statusId: state === "complete" ? "done" : "ready",
        tagIds: ["default-complexity-complex"],
      },
    ],
    plan: {
      deadlines: [{ id: "preview", name: "Preview", date: "2026-10-15" }],
      order: ["done", "open"].map((ticketId) => ({ ticketId, deadlineId: "preview" })),
    },
  });
  const section = plan.sections[0]!;
  return (
    <Box maxW="full" w="full" h="40px">
      <SectionHeader
        entry={{ section, rows: filtered ? section.rows.filter(({ done }) => !done) : section.rows, collapsed: false }}
        onToggle={() => {}}
        onDelete={() => {}}
        onRenameDeadline={async () => {}}
        onReview={() => {}}
      />
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
    await expect(estimate).toHaveTextContent("ETA ~6h");
    await expect(estimate.getBoundingClientRect().right).toBeLessThanOrEqual(progress.getBoundingClientRect().left);
  },
};
export const Learning: Story = { args: { state: "learning" } };
export const Complete: Story = { args: { state: "complete" } };
export const Filtered: Story = { args: { filtered: true }, play: Forecast.play };
