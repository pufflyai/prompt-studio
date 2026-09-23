import { Button, Dialog, Input, Stack, Text } from "@chakra-ui/react";
import type { Workspace } from "@pstdio/sdk/resources";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { FolderPicker } from "@/shared/filesystem/folder-picker";
import { useProject } from "@/shared/projects/use-project";
import { useUpdateProjectDefaults } from "../data/use-project-defaults";
import { ProjectSetupStatus } from "./project-setup-status";

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
    queryFn: () => apiRequest<Workspace[]>(`/v1/workspaces?project_id=${projectId}`),
    enabled: Boolean(projectId),
  });
  const home = query.data?.find((workspace) => workspace.is_default);
  useEffect(() => {
    setName(project?.name ?? "");
  }, [project?.name]);
  const attach = useMutation({
    mutationFn: (path: string) =>
      apiRequest(`/v1/projects/${projectId}/initial-workspace`, {
        method: "POST",
        body: { provider_id: "pstdio.root", params: { path } },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
      setAttaching(false);
    },
  });
  const retry = useMutation({
    mutationFn: () => apiRequest<Workspace>(`/v1/projects/${projectId}/retry-setup`, { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
    },
  });
  const providerError =
    home && home.provider_state !== "ready" && (home.root_path || home.provider_ref_json || home.provider_operation_id)
      ? (home.provider_error_json?.message ??
        "The workspace provider has not finished setup. Retry to check its progress.")
      : null;
  const setupError = retry.error?.message ?? home?.setup_error ?? providerError;
  return (
    <Stack padding="lg" gap="md">
      <Text textStyle="label/S/medium">Project name</Text>
      <Input aria-label="Project name" value={name} onChange={(event) => setName(event.target.value)} />
      <Button
        variant="primary"
        loading={update.isPending}
        disabled={!name.trim() || name === project?.name}
        onClick={() => update.mutate({ name: name.trim() })}
      >
        Save name
      </Button>
      {update.error && (
        <Text role="alert" color="fg.error">
          {update.error.message}
        </Text>
      )}
      <Text textStyle="label/S/medium">Project workspace</Text>
      <Text>{home?.root_path ?? home?.display_path ?? "No workspace attached"}</Text>
      {home?.provider_id === "pstdio.root" && (
        <Text color="fg.muted">Sessions work directly in this folder and share its files.</Text>
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
