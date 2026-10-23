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

export const queryWorkflowSettings = async (ctx: ExtensionContextBase) =>
  workflowSettingsControls(await readWorkflowStatuses(ctx));

export const saveWorkflowSettings = (ctx: ExtensionContextBase, values: ControlValueMap) =>
  saveWorkflowStatusSelections(ctx, {
    ...values,
    mergeTargetStatusId: values.mergeTargetStatusId || null,
  });
