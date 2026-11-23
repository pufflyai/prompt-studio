import { Box, IconButton, Stack } from "@chakra-ui/react";
import { AlertMessage, DeleteConfirmationModal, SettingsContentSkeleton } from "@pstdio/ui";
import { CodeEditor } from "@pstdio/ui/diff";
import { SettingsHeaderContent, useSettingsChanges } from "@pstdio/workbench/react";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProjectTemplateAsset } from "../data/template-provider-api";
import { useTemplateEditor } from "../data/use-templates";

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
  const { data, isLoading, pending, deleting } = query;
  const [draft, setDraft] = useState<string>();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const projected = !deleting && typeof pending?.intent === "string" ? pending.intent : data?.content;
  const content = draft ?? projected ?? "";
  const working = Boolean(pending && pending.status !== "unknown" && pending.status !== "unconfirmed");
  const deleteUnconfirmed = deleting && !working;
  const [deleteError, setDeleteError] = useState<string>();

  useEffect(() => {
    if (data === null && !pending) onDeleted();
  }, [data, pending, onDeleted]);
  const save = async () => {
    await query.save(content);
    setDraft((previous) => (previous === content ? undefined : previous));
  };

  useSettingsChanges({
    dirty: Boolean(data) && draft !== undefined && draft !== data?.content,
    saving: working,
    disabled: !data || Boolean(pending),
    onSave: save,
    onReset: () => setDraft(undefined),
  });
  const remove = async () => {
    setDeleteError(undefined);
    try {
      await query.remove(draft);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete template.");
      throw error;
    }
  };

  return (
    <Stack gap="0" h="full" minH="0" position="relative">
      <SettingsHeaderContent>
        <IconButton
          size="sm"
          variant="destructive-ghost"
          aria-label="Delete template"
          disabled={isLoading || !data || pending !== undefined}
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
            isEditable={Boolean(data) && !working}
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
      >
        {deleteUnconfirmed ? (
          <AlertMessage status="warning">Template deletion could not be confirmed. See System activity.</AlertMessage>
        ) : (
          deleteError && <AlertMessage status="error">{deleteError}</AlertMessage>
        )}
      </DeleteConfirmationModal>
    </Stack>
  );
};
