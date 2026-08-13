import { Button, Dialog, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useState } from "react";
import { deleteWorkspaceFile } from "../workspace-file-contributions";

const closeCurrentPlacement = (input: WorkbenchPanelRenderInput) => {
  input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
};

const filePathOf = (input: WorkbenchPanelRenderInput) => {
  const path = input.instance.resource?.metadata?.workspaceFilePath;
  return typeof path === "string" ? path : "this file";
};

export const DeleteWorkspaceFileWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const resource = input.instance.resource;
  const path = filePathOf(input);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!resource || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteWorkspaceFile(input.workbench, resource);
      closeCurrentPlacement(input);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The file could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog.Header py="xs" px="sm">
        <Dialog.Title textStyle="label/S/medium">Delete file</Dialog.Title>
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
            Delete file
          </Button>
        </Stack>
      </Dialog.Footer>
    </>
  );
};
