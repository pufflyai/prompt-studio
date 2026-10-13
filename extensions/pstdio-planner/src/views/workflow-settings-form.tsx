import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, ScrollArea, TagEditorHeading, TagEditorSaveBar } from "@pstdio/ui";
import { useState } from "react";
import type { WorkflowStatusSelections } from "../data/workflow-statuses";
import type { PlannerStatus } from "../public-command-refs";
import { StatusChoices } from "./status-choices";

interface WorkflowSettingsFormProps {
  selections: WorkflowStatusSelections;
  statuses: PlannerStatus[];
  onSave: (selections: WorkflowStatusSelections) => Promise<void>;
}

export function WorkflowSettingsForm(props: WorkflowSettingsFormProps) {
  const { selections, statuses, onSave } = props;
  const [draft, setDraft] = useState(selections);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const changed = JSON.stringify(draft) !== JSON.stringify(selections);
  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await onSave(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };
  const fields = [
    {
      key: "completedStatusIds",
      label: "Completed statuses",
      description: "Use these statuses for dependency completion and Timeline completion.",
    },
    {
      key: "blockedStatusIds",
      label: "Blocked statuses",
      description: "Use these statuses for blocked notifications and Timeline flags.",
    },
    {
      key: "activeStatusIds",
      label: "Active statuses",
      description: "Use these statuses for Timeline progress. Running sessions determine execution capacity.",
    },
  ] as const;
  return (
    <Stack h="full" minH="0" gap="0" bg="bg" color="fg">
      <Flex layerStyle="settingsHeader" flexShrink="0" gap="sm" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <TagEditorHeading hasChanges={changed}>Planner workflow</TagEditorHeading>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Choose the statuses each feature uses. Renaming a status preserves its selection.
          </Text>
        </Box>
        <TagEditorSaveBar
          hasChanges={changed}
          isSaving={saving}
          resetLabel="Reset"
          saveLabel="Save"
          onSave={() => void save()}
          onReset={() => {
            setDraft(selections);
            setError(undefined);
          }}
        />
      </Flex>
      <ScrollArea flex="1" minH="0" contentProps={{ p: "lg", spaceY: "lg" }}>
        <Stack gap="md">
          {fields.map(({ key, label, description }) => (
            <StatusChoices
              key={key}
              id={key}
              label={label}
              description={description}
              statuses={statuses}
              value={draft[key]}
              multiple
              disabled={saving}
              onChange={(value) => setDraft({ ...draft, [key]: value as string[] })}
            />
          ))}
          <StatusChoices
            id="mergeTargetStatusId"
            label="Status after merge"
            description="Optional destination when Mark done on merge is enabled. Choose a completed status."
            statuses={statuses.filter((status) => draft.completedStatusIds.includes(status.id))}
            value={draft.mergeTargetStatusId ?? ""}
            disabled={saving}
            onChange={(value) => setDraft({ ...draft, mergeTargetStatusId: (value as string) || null })}
          />
          {error ? <AlertMessage role="alert" status="error" title={error} /> : null}
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Empty selections disable only the corresponding status convenience. Agents maintain ticket progress using
            your current columns.
          </Text>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
