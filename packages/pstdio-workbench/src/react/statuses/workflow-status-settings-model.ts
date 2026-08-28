import type { TagEditorValue } from "@pstdio/ui";
import type { WorkflowStatus } from "../../core";

export const toStatusEditorValue = (status: WorkflowStatus): TagEditorValue => ({
  id: status.id,
  name: status.label,
  color: status.color,
  icon: status.icon,
  sortOrder: status.sortOrder,
  isDefault: status.isDefault,
  actions: [...(status.actions ?? [])],
});

const sameActions = (left: readonly string[] | undefined, right: readonly string[] | undefined) =>
  [...(left ?? [])].sort().join("|") === [...(right ?? [])].sort().join("|");

export const statusNeedsUpdate = (original: WorkflowStatus, draft: TagEditorValue) =>
  original.label !== draft.name ||
  original.color !== draft.color ||
  original.icon !== draft.icon ||
  original.isDefault !== draft.isDefault ||
  !sameActions(original.actions, draft.actions);

export const toWorkflowStatus = (draft: TagEditorValue): WorkflowStatus => ({
  id: draft.id,
  label: draft.name,
  color: draft.color,
  icon: draft.icon,
  sortOrder: draft.sortOrder,
  isDefault: draft.isDefault,
  actions: [...(draft.actions ?? [])],
});
