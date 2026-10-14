import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { parseWorkflowStatuses, readWorkflowStatuses, type WorkflowStatusSelections } from "../data/workflow-statuses";
import { withWriteGuard } from "../data/write-guard";
import { plannerTicketsChanged } from "../events";

export const saveWorkflowStatusSelections = (ctx: ExtensionContextBase, selections: unknown) =>
  withWriteGuard(ctx, "workflow-config", async () => {
    const parsed = parseWorkflowStatuses(selections);
    const current = await readWorkflowStatuses(ctx);
    const known = new Set(current.statuses.map(({ id }) => id));
    const selected = [...parsed.completedStatusIds, ...parsed.blockedStatusIds, ...parsed.activeStatusIds];
    if (selected.some((id) => !known.has(id)))
      throw new Error("Remove or replace missing status choices before saving.");
    await ctx.settings.set("workflow.statuses", parsed);
    await ctx.events.emit(plannerTicketsChanged, {});
    return readWorkflowStatuses(ctx);
  });

export const readWorkflowStatusesCommand = defineCommand({
  id: "workflow-statuses.read",
  title: "Read workflow status selections",
  cli: true,
  async run(ctx) {
    return readWorkflowStatuses(ctx);
  },
});

export const saveWorkflowStatusesCommand = defineCommand({
  id: "workflow-statuses.save",
  title: "Save workflow status selections",
  cli: true,
  mutating: true,
  params: { selections: params.json<WorkflowStatusSelections>() },
  async run(ctx, { selections }) {
    return saveWorkflowStatusSelections(ctx, selections);
  },
});
