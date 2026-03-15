import { Badge, Button, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { CodeEditor, toaster } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { useSaveProjectStartupScript } from "../hooks/use-startup-script";

interface StartupScriptEditorProps {
  projectId: string | undefined;
  startupScript: string | null | undefined;
}

const toEditableScript = (script: string | null | undefined) => script ?? "";

const draftKey = (projectId: string) => `startup-script-draft:${projectId}`;

const loadDraft = (projectId: string | undefined) => {
  if (!projectId) return null;
  return localStorage.getItem(draftKey(projectId));
};

const saveDraft = (projectId: string | undefined, script: string) => {
  if (!projectId) return;
  localStorage.setItem(draftKey(projectId), script);
};

const clearDraft = (projectId: string | undefined) => {
  if (!projectId) return;
  localStorage.removeItem(draftKey(projectId));
};

export const StartupScriptEditor = (props: StartupScriptEditorProps) => {
  const { projectId, startupScript } = props;
  const saveStartupScript = useSaveProjectStartupScript(projectId);
  const [savedScript, setSavedScript] = useState(() => toEditableScript(startupScript));
  const [draftScript, setDraftScript] = useState(() => loadDraft(projectId) ?? toEditableScript(startupScript));

  const isDirty = draftScript !== savedScript;

  useEffect(() => {
    const remoteScript = toEditableScript(startupScript);
    setSavedScript(remoteScript);

    // Only reset the draft if there is no local draft
    const localDraft = loadDraft(projectId);
    if (localDraft === null) {
      setDraftScript(remoteScript);
    }
  }, [startupScript, projectId]);

  const handleChange = (value: string) => {
    setDraftScript(value);
    saveDraft(projectId, value);
  };

  const handleSave = async () => {
    try {
      await saveStartupScript.mutateAsync(draftScript);
      setSavedScript(draftScript);
      clearDraft(projectId);
      toaster.create({ type: "success", title: "Startup script saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save startup script.";
      toaster.create({ type: "error", title: "Save failed", description: message });
    }
  };

  const handleCancel = () => {
    setDraftScript(savedScript);
    clearDraft(projectId);
  };

  return (
    <Stack height="100%" gap="0">
      <Flex padding="md" borderBottomWidth="1px" alignItems="center" justifyContent="space-between">
        <HStack gap="sm">
          <Text textStyle="heading/S">Startup script</Text>
          {isDirty ? (
            <Badge colorPalette="orange" variant="subtle" size="sm">
              Unsaved
            </Badge>
          ) : null}
        </HStack>
        <HStack gap="sm">
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={!isDirty || saveStartupScript.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="solid"
            onClick={handleSave}
            loading={saveStartupScript.isPending}
            disabled={!isDirty}
          >
            Save
          </Button>
        </HStack>
      </Flex>
      <CodeEditor
        language="shell"
        code={draftScript}
        isEditable
        showLineNumbers
        onChange={handleChange}
        disableScroll={false}
      />
    </Stack>
  );
};
