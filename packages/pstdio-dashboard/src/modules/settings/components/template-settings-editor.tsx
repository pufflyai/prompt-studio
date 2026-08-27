import { Button, HStack, Spinner, Stack, Text, Textarea } from "@chakra-ui/react";
import { DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProjectTemplateAsset } from "../data/template-provider-api";
import { useDeleteProjectTemplate, useProjectTemplate, useUpdateProjectTemplate } from "../data/use-templates";

interface TemplateSettingsEditorProps {
  template: ProjectTemplateAsset;
  onDeleted: () => void;
}

// Per-template editor for the Templates collection. The component is keyed by
// template id at the call site, so local edit state resets per template.
export const TemplateSettingsEditor = (props: TemplateSettingsEditorProps) => {
  const { template, onDeleted } = props;
  const { data, isLoading } = useProjectTemplate(template);
  const updateTemplate = useUpdateProjectTemplate(template);
  const deleteTemplate = useDeleteProjectTemplate();
  const [content, setContent] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    if (data) setContent(data.content);
  }, [data]);

  const save = async () => {
    await updateTemplate.mutateAsync(content);
    toaster.create({ type: "success", title: "Template saved", description: template.title });
  };

  const remove = async () => {
    await deleteTemplate.mutateAsync(template);
    onDeleted();
  };

  return (
    <Stack gap="md" h="full" p="lg" overflow="hidden">
      <HStack justify="space-between" align="center">
        <Text fontSize="lg" fontWeight="semibold" truncate>
          {template.title}
        </Text>
        <HStack gap="sm">
          <Button size="sm" variant="outline" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 size={14} />
            Delete
          </Button>
          <Button size="sm" onClick={save} loading={updateTemplate.isPending}>
            Save
          </Button>
        </HStack>
      </HStack>

      {isLoading ? (
        <Spinner size="sm" />
      ) : (
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          flex="1"
          resize="none"
          fontFamily="mono"
          fontSize="sm"
        />
      )}

      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onDelete={remove}
        headline="Delete template"
        notificationText={`This permanently deletes "${template.title}".`}
        buttonText="Delete template"
      />
    </Stack>
  );
};
