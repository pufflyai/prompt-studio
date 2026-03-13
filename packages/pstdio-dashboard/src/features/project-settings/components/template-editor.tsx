import { Badge, Button, Flex, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, Switch, toaster } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useDeleteProjectTemplate, useProjectTemplate, useUpdateProjectTemplate } from "../hooks/use-templates";

interface TemplateEditorProps {
  projectId: string | undefined;
  templateName: string;
  onDeleted: () => void;
}

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  prompt: "Prompt",
  ticket: "Ticket",
  document: "Document",
};

export const TemplateEditor = (props: TemplateEditorProps) => {
  const { projectId, templateName, onDeleted } = props;
  const { data: template, isLoading } = useProjectTemplate(projectId, templateName);
  const updateTemplate = useUpdateProjectTemplate(projectId);
  const deleteTemplate = useDeleteProjectTemplate(projectId);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const contentRef = useRef<string | null>(null);

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

  const handleContentChange = (value: string) => {
    contentRef.current = value;
  };

  const handleSave = async () => {
    if (contentRef.current === null) return;

    try {
      await updateTemplate.mutateAsync({ name: templateName, content: contentRef.current });
      toaster.create({ type: "success", title: "Template saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save template.";
      toaster.create({ type: "error", title: "Save failed", description: message });
    }
  };

  const handleToggleDefault = async () => {
    try {
      await updateTemplate.mutateAsync({ name: templateName, isDefault: !template.isDefault });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update template.";
      toaster.create({ type: "error", title: "Update failed", description: message });
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

  const typeLabel = TEMPLATE_TYPE_LABELS[template.templateType] ?? template.templateType;

  return (
    <>
      <Stack height="100%" gap="0">
        <Flex padding="md" borderBottomWidth="1px" alignItems="center" justifyContent="space-between">
          <HStack gap="sm">
            <Text textStyle="heading/S">{template.name}</Text>
            <Badge variant="subtle" size="sm">
              {typeLabel}
            </Badge>
          </HStack>
          <HStack gap="sm">
            <HStack gap="xs">
              <Text textStyle="label/XS/medium" color="fg.muted">
                Default
              </Text>
              <Switch
                size="sm"
                checked={template.isDefault}
                onCheckedChange={handleToggleDefault}
                disabled={updateTemplate.isPending}
              />
            </HStack>
            <Button size="sm" variant="solid" onClick={handleSave} loading={updateTemplate.isPending}>
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

        <Stack flex="1" minH="0" padding="sm" overflow="auto">
          <MarkdownEditor
            key={template.id}
            defaultState={template.content}
            isEditable
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
