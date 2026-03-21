import { Badge, Button, Flex, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { CodeEditor, DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useDeleteProjectHook, useProjectHooks, useSaveProjectHook } from "../hooks/use-hooks";

interface HookEditorProps {
  projectId: string | undefined;
  hookName: string;
  onDeleted: () => void;
}

export const HookEditor = (props: HookEditorProps) => {
  const { projectId, hookName, onDeleted } = props;
  const { data: hooks, isLoading } = useProjectHooks(projectId);
  const saveHook = useSaveProjectHook(projectId);
  const deleteHook = useDeleteProjectHook(projectId);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [savedContent, setSavedContent] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [editorKey, setEditorKey] = useState(0);

  const hook = hooks?.find((h) => h.name === hookName);

  useEffect(() => {
    const content = hook?.content ?? "";
    setSavedContent(content);
    setDraftContent(content);
    setEditorKey((k) => k + 1);
  }, [hook?.content]);

  if (isLoading) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Spinner />
      </Flex>
    );
  }

  const isDirty = draftContent !== savedContent;
  const isSaveDisabled = !isDirty || saveHook.isPending;
  const isCancelDisabled = !isDirty || saveHook.isPending;

  const handleSave = async () => {
    if (isSaveDisabled) return;

    try {
      await saveHook.mutateAsync({ hookName, content: draftContent });
      setSavedContent(draftContent);
      toaster.create({ type: "success", title: "Hook saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save hook.";
      toaster.create({ type: "error", title: "Save failed", description: message });
    }
  };

  const handleCancel = () => {
    setDraftContent(savedContent);
    setEditorKey((k) => k + 1);
  };

  const handleDelete = async () => {
    try {
      await deleteHook.mutateAsync(hookName);
      toaster.create({ type: "success", title: "Hook deleted" });
      onDeleted();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete hook.";
      toaster.create({ type: "error", title: "Delete failed", description: message });
    }
  };

  return (
    <>
      <Stack height="100%" gap="0">
        <Flex padding="md" borderBottomWidth="1px" alignItems="center" justifyContent="space-between">
          <HStack gap="sm">
            <Text textStyle="heading/S">{hookName}</Text>
            {hook?.blocking && (
              <Badge size="sm" variant="subtle">
                blocking
              </Badge>
            )}
          </HStack>
          <HStack gap="sm">
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isCancelDisabled}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="solid"
              onClick={handleSave}
              loading={saveHook.isPending}
              disabled={isSaveDisabled}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              colorPalette="red"
              onClick={() => setIsDeleteOpen(true)}
              disabled={deleteHook.isPending}
              aria-label="Delete hook"
            >
              <Trash2 size={16} />
            </Button>
          </HStack>
        </Flex>

        <Stack flex="1" minH="0" padding="0">
          <CodeEditor
            key={editorKey}
            language="shell"
            defaultCode={draftContent}
            isEditable
            showLineNumbers
            onChange={(value) => setDraftContent(value)}
          />
        </Stack>
      </Stack>

      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onDelete={handleDelete}
        headline="Delete hook?"
        notificationText={`This will remove the "${hookName}" hook script.`}
        buttonText="Delete hook"
      />
    </>
  );
};
