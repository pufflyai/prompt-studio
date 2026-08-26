import { defineStatuses, type WorkflowStatus } from "@pstdio/sdk/extensions";

const storageKey = "lab.workflow-statuses";

const defaultStatuses: WorkflowStatus[] = [
  {
    id: "idea",
    label: "Idea",
    color: "gray",
    sortOrder: 0,
    isDefault: true,
    board: { canCreate: true, canDragIn: true, canDragOut: true },
  },
  {
    id: "testing",
    label: "Testing",
    color: "blue",
    sortOrder: 1,
    board: { canDragIn: true, canDragOut: true },
  },
];

export const labWorkflowStatuses = defineStatuses({
  id: "workflow",
  title: "Lab workflow",
  async query(ctx) {
    return { statuses: (await ctx.storage.get<WorkflowStatus[]>(storageKey)) ?? defaultStatuses };
  },
  async save(ctx, input) {
    const statuses = [...input.statuses];
    await ctx.storage.set(storageKey, statuses);
    return { statuses };
  },
});
