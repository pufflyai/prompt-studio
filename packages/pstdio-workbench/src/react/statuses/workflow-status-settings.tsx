import { Stack } from "@chakra-ui/react";
import { type SaveTagSettingsInput, type TagEditorValue, TagSettingsPanel } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { RegisteredWorkbenchStatusSet, WorkbenchStatusRegistry, WorkflowStatus } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const toEditorValue = (status: WorkflowStatus): TagEditorValue => ({
  id: status.id,
  name: status.label,
  color: status.color,
  icon: status.icon,
  sortOrder: status.sortOrder,
  isDefault: status.isDefault,
});

const statusNeedsUpdate = (original: WorkflowStatus, draft: TagEditorValue) =>
  original.label !== draft.name ||
  original.color !== draft.color ||
  original.icon !== draft.icon ||
  original.isDefault !== draft.isDefault;

const toWorkflowStatus = (draft: TagEditorValue): WorkflowStatus => ({
  id: draft.id,
  label: draft.name,
  color: draft.color,
  icon: draft.icon,
  sortOrder: draft.sortOrder,
  isDefault: draft.isDefault,
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

  const save = async (input: SaveTagSettingsInput<WorkflowStatus>) => {
    const next = input.drafts.map(toWorkflowStatus);
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
