import { Box, IconButton, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, SettingsContentSkeleton, useToaster } from "@pstdio/ui";
import { CodeEditor } from "@pstdio/ui/diff";
import { SettingsHeaderContent, useSettingsChanges } from "@pstdio/workbench/react";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { ProjectTemplateAsset } from "../data/template-provider-api";
import { useDeleteProjectTemplate, useProjectTemplate, useUpdateProjectTemplate } from "../data/use-templates";

interface TemplateSettingsEditorProps {
  template: ProjectTemplateAsset;
  onDeleted: () => void;
}

// Per-template editor for the Templates collection. The component is keyed by
// template id at the call site, so local edit state resets per template.
export const TemplateSettingsEditor = (props: TemplateSettingsEditorProps) => {
  const toaster = useToaster();
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

  useSettingsChanges({
    dirty: Boolean(data) && content !== data?.content,
    saving: updateTemplate.isPending || deleteTemplate.isPending,
    onSave: save,
    onReset: () => setContent(data?.content ?? ""),
  });
  const remove = async () => {
    await deleteTemplate.mutateAsync(template);
    flushSync(() => setContent(data?.content ?? ""));
    onDeleted();
  };

  return (
    <Stack gap="0" h="full" minH="0">
      <SettingsHeaderContent>
        <IconButton
          size="sm"
          variant="destructive-ghost"
          aria-label="Delete template"
          disabled={isLoading || updateTemplate.isPending || deleteTemplate.isPending}
          onClick={() => setIsDeleteOpen(true)}
        >
          <Trash2 />
        </IconButton>
      </SettingsHeaderContent>
      {updateTemplate.error ? (
        <Text role="alert" color="fg.error">
          {updateTemplate.error.message}
        </Text>
      ) : null}
      {isLoading ? (
        <SettingsContentSkeleton />
      ) : (
        <Box flex="1" minH="0" minW="0">
          <CodeEditor
            language="markdown"
            fileName={`${template.name}.md`}
            code={content}
            onChange={setContent}
            isEditable={!updateTemplate.isPending && !deleteTemplate.isPending}
            showLineNumbers
          />
        </Box>
      )}

      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onDelete={remove}
        headline="Delete template"
        notificationText={`This permanently deletes "${template.title}". Reset changes cannot restore a deleted template.`}
        buttonText="Delete template"
      />
    </Stack>
  );
};
