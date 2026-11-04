import { Button, Dialog, Stack, Text } from "@chakra-ui/react";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useSettingsChanges } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";
import { FolderPicker } from "@/shared/filesystem/folder-picker";
import { ProjectSetupStatus } from "@/shared/projects/project-setup-status";
import { useProject } from "@/shared/projects/use-project";
import { useUpdateProjectDefaults } from "../data/use-project-defaults";

export const ProjectFolderPanel = (props: { projectId?: string }) => {
  const { projectId } = props;
  const { data: project } = useProject(projectId);
  const [name, setName] = useState("");
  const [attaching, setAttaching] = useState(false);
  const client = useQueryClient();
  const update = useUpdateProjectDefaults(projectId);
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
    mutationFn: (path: string) =>
      getApiClient().projects.attachInitialWorkspace(projectId!, { provider_id: "pstdio.root", params: { path } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
      setAttaching(false);
    },
  });
  const retry = useMutation({
    mutationFn: () => getApiClient().projects.retrySetup(projectId!),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
    },
  });
  useSettingsChanges({
    dirty: Boolean(project) && name !== project?.name,
    saving: update.isPending,
    disabled: !name.trim(),
    onSave: async () => {
      await update.mutateAsync({ name: name.trim() });
    },
    onReset: () => {
      setName(project?.name ?? "");
      update.reset();
    },
  });
  const providerError =
    home && home.provider_state !== "ready" && (home.root_path || home.provider_ref_json || home.provider_operation_id)
      ? (home.provider_error_json?.message ??
        "The workspace provider has not finished setup. Retry to check its progress.")
      : null;
  const setupError = retry.error?.message ?? home?.setup_error ?? providerError;
  return (
    <Stack gap="md">
      <ParamEditor
        changeDelay={0}
        fullWidth
        readOnly={update.isPending}
        params={[
          { id: "name", name: "Project name", type: "text", singleLine: true, defaultValue: name },
          {
            id: "folder",
            name: "Project folder",
            type: "property",
            value: home?.root_path ?? home?.display_path ?? "No workspace attached",
          },
        ]}
        onChange={(id, value) => {
          if (id === "name") setName(String(value));
        }}
      />
      {update.error && (
        <Text role="alert" color="fg.error">
          {update.error.message}
        </Text>
      )}
      {setupError && (
        <ProjectSetupStatus error={setupError} retrying={retry.isPending} onRetry={() => retry.mutate()} />
      )}
      {!home?.root_path && !home?.provider_ref_json && !home?.provider_operation_id && !query.isPending && (
        <Button variant="outline" onClick={() => setAttaching(true)}>
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
              isOpening={attach.isPending}
              error={attach.error?.message}
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
