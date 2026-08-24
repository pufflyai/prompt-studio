import { Button, Dialog, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useState } from "react";
import { deleteWorkspaceEntry } from "../workspace-file-contributions";

const closeCurrentPlacement = (input: WorkbenchPanelRenderInput) => {
  input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
};

const entryPathOf = (input: WorkbenchPanelRenderInput) => {
  const path = input.instance.resource?.metadata?.workspaceDeletePath;
  return typeof path === "string" ? path : "this entry";
};

const entryTypeOf = (input: WorkbenchPanelRenderInput) =>
  input.instance.resource?.metadata?.workspaceDeleteType === "directory" ? "folder" : "file";

export const DeleteWorkspaceEntryWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const resource = input.instance.resource;
  const path = entryPathOf(input);
  const entryType = entryTypeOf(input);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!resource || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteWorkspaceEntry(input.workbench, resource);
      closeCurrentPlacement(input);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : `The ${entryType} could not be deleted.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog.Header py="xs" px="sm">
        <Dialog.Title textStyle="label/S/medium">Delete {entryType}</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body px="sm" py="sm">
        <Stack gap="xs">
          <Text textStyle="paragraph/S/regular">Delete {path}? This action cannot be undone.</Text>
          {error ? (
            <Text textStyle="paragraph/S/regular" color="fg.error">
              {error}
            </Text>
          ) : null}
        </Stack>
      </Dialog.Body>
      <Dialog.Footer px="sm" py="sm">
        <Stack direction="row" gap="1">
          <Button variant="outline" disabled={deleting} onClick={() => closeCurrentPlacement(input)}>
            Cancel
          </Button>
          <Button variant="destructive" loading={deleting} onClick={() => void handleDelete()}>
            Delete {entryType}
          </Button>
        </Stack>
      </Dialog.Footer>
    </>
  );
};
