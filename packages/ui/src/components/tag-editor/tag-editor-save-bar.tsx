import { Button, HStack } from "@chakra-ui/react";

export interface TagEditorSaveBarProps {
  onSave: () => void;
  onReset: () => void;
  hasChanges?: boolean;
  isSaving?: boolean;
  resetLabel?: string;
  saveLabel?: string;
}

/**
 * The single commit point for a tag settings screen, anchored in its header.
 * Reset only appears while edits are pending, so the resting state stays quiet.
 */
export const TagEditorSaveBar = (props: TagEditorSaveBarProps) => {
  const { onSave, onReset, hasChanges, isSaving, resetLabel = "Reset", saveLabel = "Save" } = props;

  return (
    <HStack gap="xs">
      {hasChanges ? (
        <Button size="sm" variant="ghost" onClick={onReset} disabled={isSaving}>
          {resetLabel}
        </Button>
      ) : null}
      <Button size="sm" variant="primary" onClick={onSave} loading={isSaving} disabled={!hasChanges}>
        {saveLabel}
      </Button>
    </HStack>
  );
};
