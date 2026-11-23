import { Box, IconButton, Stack } from "@chakra-ui/react";
import { DeleteConfirmationModal, SettingsContentSkeleton } from "@pstdio/ui";
import { CodeEditor } from "@pstdio/ui/diff";
import { SettingsHeaderContent, useSettingsChanges } from "@pstdio/workbench/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";
import type { ProjectTemplateAsset } from "../data/template-provider-api";
import { useDeleteProjectTemplate, useTemplateEditor } from "../data/use-templates";

interface TemplateSettingsEditorProps {
  template: ProjectTemplateAsset;
  onDeleted: () => void;
}

// Per-template editor for the Templates collection. The component is keyed by
// template id at the call site, so local edit state resets per template.
export const TemplateSettingsEditor = (props: TemplateSettingsEditorProps) => {
  const query = useTemplateEditor(props.template);
  return (
    <TemplateEditorForm
      key={JSON.stringify([query.scope, props.template.projectId, props.template.id])}
      {...props}
      query={query}
    />
  );
};

const TemplateEditorForm = (props: TemplateSettingsEditorProps & { query: ReturnType<typeof useTemplateEditor> }) => {
  const { template, onDeleted, query } = props;
  const { data, isLoading, pending } = query;
  const deleteTemplate = useDeleteProjectTemplate();
  const [draft, setDraft] = useState<string>();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const projected = typeof pending?.intent === "string" ? pending.intent : data?.content;
  const content = draft ?? projected ?? "";
  const saving = Boolean(pending && pending.status !== "unknown" && pending.status !== "unconfirmed");
  const save = async () => {
    await query.save(content);
    setDraft((previous) => (previous === content ? undefined : previous));
  };

  useSettingsChanges({
    dirty: Boolean(data) && draft !== undefined && draft !== data?.content,
    saving: saving || deleteTemplate.isPending,
    disabled: !data || Boolean(pending),
    onSave: save,
    onReset: () => setDraft(undefined),
  });
  const remove = async () => {
    await deleteTemplate.mutateAsync(template);
    flushSync(() => setDraft(undefined));
    onDeleted();
  };

  return (
    <Stack gap="0" h="full" minH="0" position="relative">
      <SettingsHeaderContent>
        <IconButton
          size="sm"
          variant="destructive-ghost"
          aria-label="Delete template"
          disabled={isLoading || pending !== undefined || deleteTemplate.isPending}
          onClick={() => setIsDeleteOpen(true)}
        >
          <Trash2 />
        </IconButton>
      </SettingsHeaderContent>
      {isLoading ? (
        <SettingsContentSkeleton />
      ) : (
        <Box flex="1" minH="0" minW="0">
          <CodeEditor
            language="markdown"
            fileName={`${template.name}.md`}
            code={content}
            onChange={setDraft}
            isEditable={Boolean(data) && !saving && !deleteTemplate.isPending}
            showLineNumbers
          />
        </Box>
      )}

      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onDelete={remove}
        confirmDisabled={pending !== undefined}
        headline="Delete template"
        notificationText={`This permanently deletes "${template.title}". Reset changes cannot restore a deleted template.`}
        buttonText="Delete template"
      />
    </Stack>
  );
};
