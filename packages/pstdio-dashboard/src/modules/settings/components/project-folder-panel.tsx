import { Button, Dialog, Stack } from "@chakra-ui/react";
import { workbenchCommands } from "@pstdio/sdk/extensions";
import { ParamEditor } from "@pstdio/ui/param-editor";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useSettingsChanges } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getApiClient } from "@/lib/api";
import { FolderPicker } from "@/shared/filesystem/folder-picker";
import { useProjectFolderAssignment } from "@/shared/projects/project-folder-operations";
import { useProjectNameOperations } from "@/shared/projects/project-name-operations";
import { useProjectSetupPending } from "@/shared/projects/project-setup-requests";
import { ProjectSetupStatus } from "@/shared/projects/project-setup-status";
import { useProject } from "@/shared/projects/use-project";

export const ProjectFolderPanel = (props: { projectId?: string; workbench: WorkbenchCore }) => {
  const { projectId, workbench } = props;
  const setupPending = useProjectSetupPending(projectId);
  const { data: project } = useProject(projectId);
  const names = useProjectNameOperations();
  const authority = names.authority();
  const pendingName = names.pending(projectId);
  const [draft, setDraft] = useState<{ authority: string; name: string }>();
  const currentDraft = draft?.authority === authority ? draft.name : undefined;
  const name = currentDraft ?? names.name(projectId, project?.name ?? "");
  const renaming = Boolean(pendingName && pendingName.status !== "unknown" && pendingName.status !== "unconfirmed");
  const [attaching, setAttaching] = useState(false);
  const client = useQueryClient();
  const folderAssignment = useProjectFolderAssignment(projectId);
  const queryKey = ["project-workspaces", projectId];
  const query = useQuery({
    queryKey,
    queryFn: () => getApiClient().workspaces.list(projectId!),
    enabled: Boolean(projectId),
  });
  const home = query.data?.find((workspace) => workspace.is_default);
  const attach = useMutation({
    mutationFn: (path: string) => folderAssignment.assign({ mode: "attach", path }),
    onSuccess: () => setAttaching(false),
  });
  const retry = useMutation({
    mutationFn: () =>
      workbench.commands.executeCommand(workbenchCommands.retryProjectSetup.id, undefined, { projectId }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
    },
  });
  useSettingsChanges({
    dirty: Boolean(project) && currentDraft !== undefined && currentDraft.trim() !== project?.name,
    saving: renaming,
    disabled: !name.trim() || Boolean(pendingName),
    onSave: async () => {
      await names.rename(projectId, name, authority);
      setDraft((previous) => (previous === draft ? undefined : previous));
    },
    onReset: () => setDraft(undefined),
  });
  const settingUp = setupPending || home?.initializing || home?.provider_state === "provisioning";
  const providerError = !settingUp ? home?.provider_error_json?.message : undefined;
  const setupError = retry.error?.message ?? home?.setup_error ?? providerError;
  return (
    <Stack gap="md" position="relative">
      <ParamEditor
        changeDelay={0}
        fullWidth
        readOnly={renaming}
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
          if (id === "name") setDraft({ authority, name: String(value) });
        }}
      />
      {setupError && (
        <ProjectSetupStatus
          error={setupError}
          retrying={retry.isPending || setupPending}
          onRetry={() => retry.mutate()}
        />
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
