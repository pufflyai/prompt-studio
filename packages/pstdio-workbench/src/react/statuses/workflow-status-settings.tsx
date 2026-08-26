import { Stack } from "@chakra-ui/react";
import { type SaveTagSettingsInput, type TagEditorValue, TagSettingsPanel } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { RegisteredWorkbenchStatusSet, WorkbenchStatusRegistry, WorkflowStatus } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const boardRuleActions = {
  canCreate: "workbench.status.can-create",
  canDragIn: "workbench.status.can-drag-in",
  canDragOut: "workbench.status.can-drag-out",
} as const;

const statusActions = (status: WorkflowStatus) => [
  ...(status.board?.canCreate ? [boardRuleActions.canCreate] : []),
  ...(status.board?.canDragIn ? [boardRuleActions.canDragIn] : []),
  ...(status.board?.canDragOut ? [boardRuleActions.canDragOut] : []),
  ...(status.board?.actions ?? []),
];

const toEditorValue = (status: WorkflowStatus): TagEditorValue => ({
  id: status.id,
  name: status.label,
  color: status.color,
  icon: status.icon,
  sortOrder: status.sortOrder,
  isDefault: status.isDefault,
  actions: statusActions(status),
});

const sameValues = (left: readonly string[], right: readonly string[]) =>
  [...left].sort().join("|") === [...right].sort().join("|");

const statusNeedsUpdate = (original: WorkflowStatus, draft: TagEditorValue) =>
  original.label !== draft.name ||
  original.color !== draft.color ||
  original.icon !== draft.icon ||
  original.isDefault !== draft.isDefault ||
  !sameValues(statusActions(original), draft.actions ?? []);

const toWorkflowStatus = (
  draft: TagEditorValue,
  original: WorkflowStatus | undefined,
  providerActionIds: ReadonlySet<string>,
): WorkflowStatus => ({
  id: draft.id,
  label: draft.name,
  color: draft.color,
  icon: draft.icon,
  sortOrder: draft.sortOrder,
  isDefault: draft.isDefault,
  board: {
    ...original?.board,
    canCreate: draft.actions?.includes(boardRuleActions.canCreate),
    canDragIn: draft.actions?.includes(boardRuleActions.canDragIn),
    canDragOut: draft.actions?.includes(boardRuleActions.canDragOut),
    actions: draft.actions?.filter((action) => providerActionIds.has(action)),
  },
});

interface WorkflowStatusSectionProps {
  statusSet: RegisteredWorkbenchStatusSet;
  workbench: { statuses: WorkbenchStatusRegistry };
}

const WorkflowStatusSection = (props: WorkflowStatusSectionProps) => {
  const { statusSet, workbench } = props;
  const [statuses, setStatuses] = useState<WorkflowStatus[] | undefined>(() => {
    const cached = workbench.statuses.getStatuses(statusSet.id);
    return cached ? [...cached] : undefined;
  });
  const [loadError, setLoadError] = useState<unknown>();

  useEffect(() => {
    let current = true;
    const cached = workbench.statuses.getStatuses(statusSet.id);
    setStatuses(cached ? [...cached] : undefined);
    setLoadError(undefined);
    void workbench.statuses.load(statusSet.id).then(
      (value) => {
        if (current) setStatuses([...value]);
      },
      (error) => {
        if (current) setLoadError(error);
      },
    );
    return () => {
      current = false;
    };
  }, [statusSet.id, workbench]);

  const providerActionIds = new Set((statusSet.actions ?? []).map((action) => action.id));
  const actionOptions = [
    { value: boardRuleActions.canCreate, label: "Create in column" },
    { value: boardRuleActions.canDragIn, label: "Drag in" },
    { value: boardRuleActions.canDragOut, label: "Drag out" },
    ...(statusSet.actions ?? []).map((action) => ({ value: action.id, label: action.label })),
  ];

  const save = async (input: SaveTagSettingsInput<WorkflowStatus>) => {
    const next = input.drafts.map((draft) =>
      toWorkflowStatus(
        draft,
        input.values.find((status) => status.id === draft.id),
        providerActionIds,
      ),
    );
    setStatuses([...(await workbench.statuses.save(statusSet.id, next))]);
  };

  return (
    <TagSettingsPanel
      values={statuses}
      loadError={loadError}
      onSave={save}
      toEditorValue={toEditorValue}
      valueNeedsUpdate={statusNeedsUpdate}
      readOnly={!statusSet.save}
      title={statusSet.title}
      description={statusSet.save ? "Configure this workflow's columns." : "This status set is read-only."}
      actionOptions={actionOptions}
      showDefault
      errorTitle={`Unable to update ${statusSet.title}`}
      addLabel="Add status"
      addName="New status"
      resetLabel="Reset"
      saveLabel="Save"
      deleteHeadline="Delete status?"
      deleteNotificationText={(status) => `This will delete the "${status.name}" status.`}
      deleteButtonText="Delete status"
    />
  );
};

interface WorkflowStatusSettingsProps {
  workbench: { statuses: WorkbenchStatusRegistry };
}

export const WorkflowStatusSettings = (props: WorkflowStatusSettingsProps) => {
  const { workbench } = props;
  useWorkbenchStore(workbench.statuses.store, (state) => state.statusSets);
  const statusSets = workbench.statuses.listStatusSets();

  return (
    <Stack gap="none" minH="full" bg="bg">
      {statusSets.map((statusSet) => (
        <Stack key={statusSet.id} data-testid={`workflow-status-set-${statusSet.id}`} gap="none">
          <WorkflowStatusSection workbench={workbench} statusSet={statusSet} />
        </Stack>
      ))}
    </Stack>
  );
};
