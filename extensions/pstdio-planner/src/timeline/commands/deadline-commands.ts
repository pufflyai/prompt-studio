// Create, change, and delete deadlines. Deleting a deadline keeps its tickets, without a due date.

import { defineCommand, params } from "@pstdio/sdk/extensions";
import { addDeadline, removeDeadline, updateDeadline } from "../model/edit-plan";
import { findDeadlineId, loadPlan, savePlan } from "./plan-store";
import { withWriteGuard } from "./write-guard";

const deadlineParam = params.text({ label: "Deadline", description: "Deadline id or date.", required: true });

export const createDeadlineCommand = defineCommand({
  id: "timeline.deadline.create",
  mutating: true,
  title: "Create deadline",
  cli: {
    description: "Add a deadline. Move tickets into it to make them due by its date.",
    examples: ['pst pstdio-planner timeline deadline create --date 2026-10-15 --name "Staging acceptance"'],
  },
  params: {
    date: params.text({ label: "Date", description: "YYYY-MM-DD.", required: true }),
    name: params.text({ label: "Name", description: "Optional short name, such as Staging acceptance." }),
  },
  async run(ctx, { date, name }) {
    return withWriteGuard(ctx, "plan", async () => {
      const { plan } = await loadPlan(ctx);
      const deadline = { id: crypto.randomUUID(), date, ...(name ? { name } : {}) };
      const next = addDeadline(plan, deadline);
      await savePlan(ctx, next, "deadline");
      return next.deadlines.find(({ id }) => id === deadline.id);
    });
  },
});

export const updateDeadlineCommand = defineCommand({
  id: "timeline.deadline.update",
  mutating: true,
  title: "Change deadline",
  cli: {
    description: "Change a deadline's date or name. Its tickets stay with it.",
    examples: ["pst pstdio-planner timeline deadline update --deadline 2026-10-15 --date 2026-10-17"],
  },
  params: {
    deadline: deadlineParam,
    date: params.text({ label: "Date", description: "New date, YYYY-MM-DD." }),
    name: params.text({ label: "Name", description: "New name. none removes the name." }),
  },
  async run(ctx, { deadline, date, name }) {
    return withWriteGuard(ctx, "plan", async () => {
      const { plan } = await loadPlan(ctx);
      const deadlineId = findDeadlineId(plan, deadline);
      const next = updateDeadline(plan, deadlineId, {
        ...(date ? { date } : {}),
        ...(name === undefined ? {} : { name: name === "none" ? "" : name }),
      });
      await savePlan(ctx, next, "deadline");
      return next.deadlines.find(({ id }) => id === deadlineId);
    });
  },
});

export const deleteDeadlineCommand = defineCommand({
  id: "timeline.deadline.delete",
  mutating: true,
  title: "Delete deadline",
  cli: { description: "Delete a deadline. Its tickets keep their order and lose their due date." },
  params: { deadline: deadlineParam },
  async run(ctx, { deadline }) {
    return withWriteGuard(ctx, "plan", async () => {
      const { plan } = await loadPlan(ctx);
      const deadlineId = findDeadlineId(plan, deadline);
      await savePlan(ctx, removeDeadline(plan, deadlineId), "deadline");
      return { deleted: deadlineId };
    });
  },
});
