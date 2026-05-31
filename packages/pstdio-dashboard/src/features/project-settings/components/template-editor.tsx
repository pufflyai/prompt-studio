import { Button, Flex, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, ScrollArea, toaster } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDeleteProjectTemplate, useProjectTemplate, useUpdateProjectTemplate } from "../hooks/use-templates";
import {
  clearTemplateDraft,
  isTemplateEditorEmpty,
  loadTemplateDraft,
  saveTemplateDraft,
} from "./template-editor-draft";

interface TemplateEditorProps {
  projectId: string | undefined;
  templateName: string;
  onDeleted: () => void;
}

export const TemplateEditor = (props: TemplateEditorProps) => {
  const { projectId, templateName, onDeleted } = props;
  const { data: template, isLoading } = useProjectTemplate(projectId, templateName);
  const updateTemplate = useUpdateProjectTemplate(projectId);
  const deleteTemplate = useDeleteProjectTemplate(projectId);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [savedContent, setSavedContent] = useState("");
  const [draftContent, setDraftContent] = useState(() => loadTemplateDraft(undefined, projectId, templateName) ?? "");
  const [editorKey, setEditorKey] = useState(0);
  const hasEditorInitialized = useRef(false);

  useEffect(() => {
    if (!template) return;

    hasEditorInitialized.current = false;
    const localDraft = loadTemplateDraft(undefined, projectId, templateName);
    setSavedContent(template.content);
    setDraftContent(localDraft ?? template.content);
  }, [projectId, templateName, template]);

  if (isLoading) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Spinner />
      </Flex>
    );
  }

  if (!template) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Template not found.
        </Text>
      </Flex>
    );
  }

  const isDirty = draftContent !== savedContent;
  const isSaveDisabled = !isDirty || isTemplateEditorEmpty(draftContent) || updateTemplate.isPending;
  const isCancelDisabled = !isDirty || updateTemplate.isPending;

  const handleContentChange = (value: string) => {
    // Lexical re-serializes markdown on init, which may differ from the original.
    // Treat the first onChange as the baseline when no draft exists.
    if (!hasEditorInitialized.current) {
      hasEditorInitialized.current = true;
      const hasDraft = loadTemplateDraft(undefined, projectId, templateName) !== null;
      if (!hasDraft) {
        setSavedContent(value);
        setDraftContent(value);
        return;
      }
    }
    setDraftContent(value);
    saveTemplateDraft(undefined, projectId, templateName, value);
  };

  const handleCancel = () => {
    hasEditorInitialized.current = false;
    setDraftContent(savedContent);
    clearTemplateDraft(undefined, projectId, templateName);
    setEditorKey((k) => k + 1);
  };

  const handleSave = async () => {
    if (isSaveDisabled) return;

    try {
      await updateTemplate.mutateAsync({
        name: templateName,
        content: draftContent,
        installName: template.installName,
        key: template.key,
        sourceKind: template.sourceKind,
      });
      setSavedContent(draftContent);
      clearTemplateDraft(undefined, projectId, templateName);
      toaster.create({ type: "success", title: "Template saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save template.";
      toaster.create({ type: "error", title: "Save failed", description: message });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTemplate.mutateAsync(templateName);
      toaster.create({ type: "success", title: "Template deleted" });
      onDeleted();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete template.";
      toaster.create({ type: "error", title: "Delete failed", description: message });
      throw error;
    }
  };

  const editorInitialContent = loadTemplateDraft(undefined, projectId, templateName) ?? template.content;

  return (
    <>
      <Stack height="100%" gap="0">
        <Flex padding="md" borderBottomWidth="1px" alignItems="center" justifyContent="space-between">
          <Text textStyle="heading/S">{template.name}</Text>
          <HStack gap="sm">
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isCancelDisabled}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSave}
              loading={updateTemplate.isPending}
              disabled={isSaveDisabled}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              colorPalette="red"
              onClick={() => setIsDeleteOpen(true)}
              disabled={deleteTemplate.isPending}
              aria-label="Delete template"
            >
              <Trash2 size={16} />
            </Button>
          </HStack>
        </Flex>

        <ScrollArea flex="1" minH="0" contentProps={{ p: "sm" }}>
          <MarkdownEditor
            key={`${template.id}-${editorKey}`}
            defaultState={editorInitialContent}
            isEditable
            placeholder="Enter template content..."
            onChange={handleContentChange}
          />
        </ScrollArea>
      </Stack>

      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onDelete={handleDelete}
        headline="Delete template?"
        notificationText={`This will permanently delete the template "${template.name}".`}
        buttonText="Delete template"
      />
    </>
  );
};
