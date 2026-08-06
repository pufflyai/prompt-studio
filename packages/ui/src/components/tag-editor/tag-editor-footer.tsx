import { Button, Flex, HStack } from "@chakra-ui/react";

export interface TagEditorFooterProps {
  onSave: () => void;
  onCancel: () => void;
  hasChanges?: boolean;
  isSaving?: boolean;
  cancelLabel?: string;
  saveLabel?: string;
}

/** Single Cancel/Save footer shared by every tag section in an editor screen. */
export const TagEditorFooter = (props: TagEditorFooterProps) => {
  const { onSave, onCancel, hasChanges, isSaving, cancelLabel = "Cancel", saveLabel = "Save" } = props;

  return (
    <Flex justifyContent="flex-end">
      <HStack gap="xs">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={!hasChanges || isSaving}>
          {cancelLabel}
        </Button>
        <Button size="sm" variant="primary" onClick={onSave} loading={isSaving} disabled={!hasChanges}>
          {saveLabel}
        </Button>
      </HStack>
    </Flex>
  );
};
