import { Button, Flex, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { Copy as CopyIcon, EyeOff, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useCopyProjectTemplate,
  useDeleteProjectTemplate,
  useDisableProjectTemplateDefault,
  useProjectTemplate,
  useUpdateProjectTemplate,
} from "../hooks/use-templates";
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
  const copyTemplate = useCopyProjectTemplate(projectId);
  const disableTemplate = useDisableProjectTemplateDefault(projectId);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [savedContent, setSavedContent] = useState("");
  const [draftContent, setDraftContent] = useState(() => loadTemplateDraft(undefined, projectId, templateName) ?? "");
  const [editorKey, setEditorKey] = useState(0);
  const hasEditorInitialized = useRef(false);

  useEffect(() => {
    if (!template) return;

    hasEditorInitialized.current = false;
    const localDraft = template.readOnly ? null : loadTemplateDraft(undefined, projectId, templateName);
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
  const isReadOnly = Boolean(template.readOnly);
  const isSaveDisabled = isReadOnly || !isDirty || isTemplateEditorEmpty(draftContent) || updateTemplate.isPending;
  const isCancelDisabled = isReadOnly || !isDirty || updateTemplate.isPending;

  const handleContentChange = (value: string) => {
    if (isReadOnly) return;

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
      await updateTemplate.mutateAsync({ name: templateName, content: draftContent });
      setSavedContent(draftContent);
      clearTemplateDraft(undefined, projectId, templateName);
      toaster.create({ type: "success", title: "Template saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save template.";
      toaster.create({ type: "error", title: "Save failed", description: message });
    }
  };

  const handleCopy = async () => {
    try {
      await copyTemplate.mutateAsync(templateName);
      clearTemplateDraft(undefined, projectId, templateName);
      toaster.create({ type: "success", title: "Template copied" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy template.";
      toaster.create({ type: "error", title: "Copy failed", description: message });
    }
  };

  const handleDisable = async () => {
    try {
      await disableTemplate.mutateAsync(templateName);
      toaster.create({ type: "success", title: "Template disabled" });
      onDeleted();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to disable template.";
      toaster.create({ type: "error", title: "Disable failed", description: message });
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

  const editorInitialContent = isReadOnly
    ? template.content
    : (loadTemplateDraft(undefined, projectId, templateName) ?? template.content);

  return (
    <>
      <Stack height="100%" gap="0">
        <Flex padding="md" borderBottomWidth="1px" alignItems="center" justifyContent="space-between">
          <Text textStyle="heading/S">{template.name}</Text>
          <HStack gap="sm">
            {isReadOnly ? (
              <>
                <Button size="sm" variant="outline" onClick={handleCopy} loading={copyTemplate.isPending}>
                  <CopyIcon size={16} />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDisable}
                  loading={disableTemplate.isPending}
                  colorPalette="red"
                >
                  <EyeOff size={16} />
                  Disable
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </HStack>
        </Flex>

        <Stack flex="1" minH="0" padding="sm" overflow="auto">
          <MarkdownEditor
            key={`${template.id}-${editorKey}`}
            defaultState={editorInitialContent}
            isEditable={!isReadOnly}
            placeholder="Enter template content..."
            onChange={handleContentChange}
          />
        </Stack>
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
