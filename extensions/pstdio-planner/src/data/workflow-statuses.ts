import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { readTicketStatuses } from "./status-operations";

export interface WorkflowStatusSelections {
  completedStatusIds: string[];
  blockedStatusIds: string[];
  activeStatusIds: string[];
  mergeTargetStatusId: string | null;
}

export const emptyWorkflowStatuses = (): WorkflowStatusSelections => ({
  completedStatusIds: [],
  blockedStatusIds: [],
  activeStatusIds: [],
  mergeTargetStatusId: null,
});

export const parseWorkflowStatuses = (value: unknown) => {
  if (value === undefined || value === null || value === "") return emptyWorkflowStatuses();
  if (typeof value !== "object") throw new Error("Workflow status selections must be an object.");
  const input = value as WorkflowStatusSelections;
  const keys = ["completedStatusIds", "blockedStatusIds", "activeStatusIds"] as const;
  for (const key of keys) {
    if (!Array.isArray(input[key]) || input[key].some((id) => typeof id !== "string" || !id))
      throw new Error("Choose status IDs for each workflow selection.");
  }
  const all = keys.flatMap((key) => input[key]);
  if (new Set(all).size !== all.length) throw new Error("Completed, blocked, and active statuses must not overlap.");
  if (input.mergeTargetStatusId !== null && !input.completedStatusIds.includes(input.mergeTargetStatusId))
    throw new Error("The status after merge must be a completed status.");
  return Object.fromEntries([
    ...keys.map((key) => [key, [...input[key]]]),
    ["mergeTargetStatusId", input.mergeTargetStatusId],
  ]) as unknown as WorkflowStatusSelections;
};

type WorkflowContext = Pick<ExtensionContextBase, "settings" | "storage">;

export const readWorkflowStatuses = async (ctx: WorkflowContext) => {
  const selections = parseWorkflowStatuses((await ctx.settings.all())["workflow.statuses"]);
  const { statuses } = await readTicketStatuses(ctx.storage);
  const known = new Set(statuses.map(({ id }) => id));
  const ids = [...selections.completedStatusIds, ...selections.blockedStatusIds, ...selections.activeStatusIds];
  return { selections, statuses, missingStatusIds: ids.filter((id) => !known.has(id)) };
};

// A removed choice stays visible but cannot supply workflow meaning.
export const usableWorkflowStatuses = (input: Awaited<ReturnType<typeof readWorkflowStatuses>>) => {
  const missing = new Set(input.missingStatusIds);
  return {
    ...input.selections,
    completedStatusIds: input.selections.completedStatusIds.filter((id) => !missing.has(id)),
    blockedStatusIds: input.selections.blockedStatusIds.filter((id) => !missing.has(id)),
    activeStatusIds: input.selections.activeStatusIds.filter((id) => !missing.has(id)),
    mergeTargetStatusId: missing.has(input.selections.mergeTargetStatusId ?? "")
      ? null
      : input.selections.mergeTargetStatusId,
  };
};

export const readMergeDestination = async (ctx: WorkflowContext) => {
  const { selections, statuses, missingStatusIds } = await readWorkflowStatuses(ctx);
  if (!selections.mergeTargetStatusId || missingStatusIds.includes(selections.mergeTargetStatusId))
    return {
      status: null,
      reason: "Choose a current completed status as Status after merge in the Planner extension's Settings tab.",
    };
  return { status: statuses.find(({ id }) => id === selections.mergeTargetStatusId)!, reason: null };
};
