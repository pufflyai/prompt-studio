import { Stack } from "@chakra-ui/react";
import { type SaveTagSettingsInput, TagSettingsPanel } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { RegisteredWorkbenchStatusSet, WorkbenchStatusRegistry, WorkflowStatus } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { statusNeedsUpdate, toStatusEditorValue, toWorkflowStatus } from "./workflow-status-settings-model";

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
      toEditorValue={toStatusEditorValue}
      valueNeedsUpdate={statusNeedsUpdate}
      readOnly={!statusSet.save}
      title={statusSet.title}
      description={statusSet.save ? undefined : "This status set is read-only."}
      actionOptions={statusSet.actions?.map((action) => ({
        value: action.id,
        label: action.label,
        icon: action.icon ? <WorkbenchIcon name={action.icon} size={13} /> : undefined,
      }))}
      actionsLabel="Commands"
      framed
      showColumnHeaders
      valueColumnLabel="State"
      showDefault
      errorTitle={`Unable to update ${statusSet.title}`}
      addLabel="Add state"
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
