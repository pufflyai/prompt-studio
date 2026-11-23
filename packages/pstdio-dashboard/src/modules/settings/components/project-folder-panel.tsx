import { Button, Dialog, Stack } from "@chakra-ui/react";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useSettingsChanges } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";
import { FolderPicker } from "@/shared/filesystem/folder-picker";
import { useProjectFolderAssignment } from "@/shared/projects/project-folder-operations";
import { ProjectSetupStatus } from "@/shared/projects/project-setup-status";
import { useProject } from "@/shared/projects/use-project";

export const ProjectFolderPanel = (props: { projectId?: string }) => {
  const { projectId } = props;
  const { data: project } = useProject(projectId);
  const [name, setName] = useState("");
  const [attaching, setAttaching] = useState(false);
  const client = useQueryClient();
  const folderAssignment = useProjectFolderAssignment(projectId);
  const rename = useMutation({
    mutationFn: (name: string) => getApiClient().projects.update(projectId!, { name }),
  });
  const queryKey = ["project-workspaces", projectId];
  const query = useQuery({
    queryKey,
    queryFn: () => getApiClient().workspaces.list(projectId!),
    enabled: Boolean(projectId),
  });
  const home = query.data?.find((workspace) => workspace.is_default);
  useEffect(() => {
    setName(project?.name ?? "");
  }, [project?.name]);
  const attach = useMutation({
    mutationFn: (path: string) => folderAssignment.assign({ mode: "attach", path }),
    onSuccess: () => setAttaching(false),
  });
  const retry = useMutation({
    mutationFn: () => getApiClient().projects.retrySetup(projectId!),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
    },
  });
  useSettingsChanges({
    dirty: Boolean(project) && name !== project?.name,
    saving: rename.isPending,
    disabled: !name.trim(),
    onSave: async () => {
      await rename.mutateAsync(name.trim());
    },
    onReset: () => {
      setName(project?.name ?? "");
      rename.reset();
    },
  });
  const settingUp = home?.initializing || home?.provider_state === "provisioning";
  const providerError = !settingUp ? home?.provider_error_json?.message : undefined;
  const setupError = retry.error?.message ?? home?.setup_error ?? providerError;
  return (
    <Stack gap="md" position="relative">
      <ParamEditor
        changeDelay={0}
        fullWidth
        readOnly={rename.isPending}
        params={[
          { id: "name", name: "Project name", type: "text", singleLine: true, defaultValue: name },
          {
            id: "folder",
            name: "Project folder",
            type: "property",
            value: settingUp
              ? "Setting up workspace"
              : (home?.root_path ?? home?.display_path ?? "No workspace attached"),
          },
        ]}
        onChange={(id, value) => {
          if (id === "name") setName(String(value));
        }}
      />
      {setupError && (
        <ProjectSetupStatus error={setupError} retrying={retry.isPending} onRetry={() => retry.mutate()} />
      )}
      {!home?.root_path &&
        !home?.provider_ref_json &&
        !home?.provider_operation_id &&
        !query.isPending &&
        !settingUp && (
          <Button variant="outline" disabled={folderAssignment.busy} onClick={() => setAttaching(true)}>
            Attach project folder
          </Button>
        )}
      <Dialog.Root
        open={attaching}
        onOpenChange={(event) => setAttaching(event.open)}
        closeOnInteractOutside={false}
        lazyMount
        unmountOnExit
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <FolderPicker
              isOpening={folderAssignment.working}
              selectionDisabled={folderAssignment.busy}
              error={
                attach.error?.message ??
                (folderAssignment.error instanceof Error ? folderAssignment.error.message : undefined)
              }
              onClose={() => setAttaching(false)}
              onSelect={async (path) => {
                try {
                  await attach.mutateAsync(path);
                } catch {}
              }}
            />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
};
