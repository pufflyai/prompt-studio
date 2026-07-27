import { Button, Dialog, Input, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { renameDashboardWorkspace } from "@/shared/workspaces/workspace-actions";

const closeCurrentPlacement = (input: WorkbenchPanelRenderInput) => {
  input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
};

const workspaceNameLimit = 120;

export const RenameWorkspaceWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const workspaceId = input.instance.resource?.id ?? "";
  const initialName = input.instance.resource?.label ?? "";
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const renameWorkspaceMutation = useMutation({
    mutationFn: (nextName: string) => renameDashboardWorkspace(workspaceId, nextName),
  });
  const trimmedName = name.trim();
  const isWorking = renameWorkspaceMutation.isPending;
  const canRename =
    Boolean(workspaceId) &&
    trimmedName.length > 0 &&
    trimmedName.length <= workspaceNameLimit &&
    trimmedName !== initialName &&
    !isWorking;

  useEffect(() => {
    setName(initialName);
    setError("");
  }, [initialName]);

  const handleRename = async () => {
    if (!workspaceId) return;

    if (!trimmedName) {
      setError("Workspace name is required");
      return;
    }

    if (trimmedName.length > workspaceNameLimit) {
      setError("Workspace name must be 120 characters or less");
      return;
    }

    if (trimmedName === initialName) {
      closeCurrentPlacement(input);
      return;
    }

    try {
      await renameWorkspaceMutation.mutateAsync(trimmedName);
      input.workbench.notifications.show({
        level: "success",
        title: `Renamed workspace to ${trimmedName}`,
      });
      closeCurrentPlacement(input);
    } catch (mutationError) {
      input.workbench.notifications.show({
        level: "error",
        title: "Failed to rename workspace",
        message: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    }
  };

  return (
    <>
      <Dialog.Header py="xs" px="sm">
        <Dialog.Title textStyle="label/S/medium">Rename workspace</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body px="sm" py="sm">
        <Stack gap="2xs">
          <Text textStyle="label/S/medium">Workspace name</Text>
          <Input
            value={name}
            aria-label="Workspace name"
            autoFocus
            disabled={isWorking}
            maxLength={workspaceNameLimit}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canRename) {
                void handleRename();
              }
            }}
          />
          {error ? (
            <Text textStyle="paragraph/S/regular" color="fg.error">
              {error}
            </Text>
          ) : null}
        </Stack>
      </Dialog.Body>
      <Dialog.Footer px="sm" py="sm">
        <Stack direction="row" gap="1">
          <Button onClick={() => closeCurrentPlacement(input)} variant="outline" disabled={isWorking}>
            Cancel
          </Button>
          <Button onClick={handleRename} loading={isWorking} variant="primary" disabled={!canRename}>
            Rename workspace
          </Button>
        </Stack>
      </Dialog.Footer>
    </>
  );
};
