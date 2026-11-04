import type { ControlParam, ControlsQueryResult, ControlValueMap, ExtensionContextBase } from "@pstdio/sdk/extensions";
import { saveWorkflowStatusSelections } from "../commands/workflow-statuses";
import { readWorkflowStatuses } from "../data/workflow-statuses";

export const workflowSettingsControls = (input: Awaited<ReturnType<typeof readWorkflowStatuses>>) => {
  const { selections, statuses, missingStatusIds } = input;
  const options = [
    ...statuses.map(({ id, name, icon, color }) => ({ id, name, icon: icon ?? "circle", color: color ?? undefined })),
    ...missingStatusIds.map((id) => ({ id, name: `Missing status: ${id}` })),
  ];
  const fields = [
    {
      id: "completedStatusIds",
      name: "Completed statuses",
      description: "Use these statuses for dependency completion and Timeline completion.",
    },
    {
      id: "blockedStatusIds",
      name: "Blocked statuses",
      description: "Use these statuses for blocked notifications and Timeline flags.",
    },
    {
      id: "activeStatusIds",
      name: "Active statuses",
      description: "Use these statuses for Timeline progress. Running sessions determine execution capacity.",
    },
  ] as const;
  const params: ControlParam[] = fields.map((field) => ({
    ...field,
    type: "selection",
    defaultValue: selections[field.id],
    options,
    multiSelect: true,
    searchable: true,
  }));
  params.push({
    id: "mergeTargetStatusId",
    name: "Status after merge",
    description: "Optional destination when Mark done on merge is enabled. Choose a completed status.",
    type: "selection",
    defaultValue: selections.mergeTargetStatusId ?? "",
    options,
    clearable: true,
    searchable: true,
  });
  return {
    groups: [
      {
        id: "workflow",
        title: "Planner workflow",
        description: "Choose the statuses each feature uses. Renaming a status preserves its selection.",
        params,
      },
    ],
    values: { ...selections, mergeTargetStatusId: selections.mergeTargetStatusId ?? "" },
  } satisfies ControlsQueryResult;
};

const automationFields = [
  { id: "tickets.deleteLinkedWorkspaces", name: "Delete linked workspaces", type: "boolean", fallback: true },
  { id: "tickets.markDoneOnMerge", name: "Mark done on merge", type: "boolean", fallback: true },
  { id: "refinement.updateCanvasDesign", name: "Update Canvas design", type: "boolean", fallback: true },
  { id: "implementation.adversarialReview", name: "Adversarial review", type: "boolean", fallback: true },
  { id: "implementation.openPr", name: "Open pull requests", type: "boolean", fallback: true },
  { id: "implementation.defaultTargetBranch", name: "Target branch", type: "text", fallback: "" },
  { id: "automation.maxInProgress", name: "Maximum in-progress tickets", type: "number", fallback: 2 },
] as const;
export const queryWorkflowSettings = async (ctx: ExtensionContextBase) => {
  const workflow = workflowSettingsControls(await readWorkflowStatuses(ctx));
  const settings = await ctx.settings.all();
  const values: ControlValueMap = {};
  const params: ControlParam[] = automationFields.map((field) => {
    const stored = settings[field.id];
    if (field.type === "boolean") {
      const value = typeof stored === "boolean" ? stored : field.fallback;
      values[field.id] = value;
      return { id: field.id, name: field.name, type: "boolean", defaultValue: value };
    }
    if (field.type === "number") {
      const value = typeof stored === "number" ? stored : field.fallback;
      values[field.id] = value;
      return { id: field.id, name: field.name, type: "number", min: 0, defaultValue: value };
    }
    const value = typeof stored === "string" ? stored : field.fallback;
    values[field.id] = value;
    return { id: field.id, name: field.name, type: "text", singleLine: true, defaultValue: value };
  });
  return {
    groups: [
      ...workflow.groups,
      {
        id: "implementation",
        title: "Implementation",
        params: params.filter((field) => field.id !== "automation.maxInProgress"),
      },
      {
        id: "automation",
        title: "Automation",
        params: params.filter((field) => field.id === "automation.maxInProgress"),
      },
    ],
    values: { ...workflow.values, ...values },
  } satisfies ControlsQueryResult;
};
export const saveWorkflowSettings = async (ctx: ExtensionContextBase, values: ControlValueMap) => {
  await saveWorkflowStatusSelections(ctx, {
    completedStatusIds: values.completedStatusIds,
    blockedStatusIds: values.blockedStatusIds,
    activeStatusIds: values.activeStatusIds,
    mergeTargetStatusId: values.mergeTargetStatusId || null,
  });
  for (const field of automationFields) {
    if (values[field.id] !== undefined) await ctx.settings.set(field.id, values[field.id]);
  }
};
