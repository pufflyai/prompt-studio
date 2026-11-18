import { Button, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import type { CloudProjectCatalogEntry, ProjectCopyAccount } from "@pstdio/sdk/client";
import { AlertMessage } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiClient } from "@/lib/api";
import { useCollectionSelection } from "@/lib/sync/use-collection-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { cloudProjectCatalogKey, useCloudProjectCatalog } from "../data/project-catalog";
import { findDashboardProject } from "../data/project-data";
import { CloudProjectDeletionAction } from "./cloud-project-deletion";
import { LocalProjectRemoval } from "./local-project-removal";

const useCloudCopyDownload = (
  input: WorkbenchPanelRenderInput,
  options: {
    id: string;
    downloading: boolean;
    requested: boolean;
    deleting: boolean;
    entry?: CloudProjectCatalogEntry;
    account?: ProjectCopyAccount;
    setRequested: (requested: boolean) => void;
  },
) => {
  const { id, downloading, requested, deleting, entry, account, setRequested } = options;
  const queryClient = useQueryClient();
  useCollectionSelection({ tables: ["projects", "workspaces"] });
  const localName = findDashboardProject(id)?.name;
  const sync = useQuery({
    queryKey: ["cloud-project-opening", account?.managerOrigin, account?.accountId, id],
    queryFn: ({ signal }) => getApiClient().account.projectSyncStatus(id, { signal, expected: account }),
    enabled: downloading && Boolean(localName && account),
    retry: false,
    refetchInterval: 1500,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: cloudProjectCatalogKey });
  const download = useMutation({
    mutationFn: () => getApiClient().account.downloadCloudProject(id),
    onSuccess() {
      setRequested(true);
      void refresh();
    },
  });

  useEffect(() => {
    if (!requested || entry?.presence !== "downloaded" || !localName || deleting) return;
    input.workbench.overlays.closeOverlay(input.instance.instanceId);
    void input.workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
      project: { id, name: localName },
    });
  }, [entry?.presence, id, input.instance.instanceId, input.workbench, requested, localName, deleting]);

  return { sync, download, refresh };
};

const downloadMessage = (error: Error | null, entry?: CloudProjectCatalogEntry, syncState?: string) => {
  if (error) return error.message;
  if (entry?.downloadError) return entry.downloadError;
  if (syncState === "needs-attention") return "Cloud download needs attention. Retry to continue.";
};

const useCloudProjectChoice = (input: WorkbenchPanelRenderInput) => {
  const id = input.instance.resource?.id ?? "";
  const name = input.instance.title ?? id;
  const cloud = useCloudProjectCatalog();
  const entry = cloud.data?.projects.find((entry) => entry.id === id);
  const receipt = cloud.data?.deletions.find((entry) => entry.projectId === id);
  const account = cloud.data?.account;
  const [requested, setRequested] = useState(false);
  const scope = JSON.stringify([id, account?.accountId, account?.managerOrigin]);
  const [deletionScope, setDeletionScope] = useState<string>();
  const deleting = Boolean(receipt || deletionScope === scope);
  useEffect(() => {
    if (receipt) setDeletionScope(scope);
  }, [receipt, scope]);
  const backButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backButton.current?.focus();
  }, []);
  const downloading = requested || entry?.presence === "downloading";
  const { sync, download, refresh } = useCloudCopyDownload(input, {
    id,
    downloading,
    requested,
    deleting,
    entry,
    account,
    setRequested,
  });
  const back = useCallback(() => {
    input.workbench.overlays.closeOverlay(input.instance.instanceId);
    void input.workbench.commands.executeCommand(dashboardCommandIds.openProjects);
  }, [input.workbench, input.instance.instanceId]);

  const failure = downloadMessage(download.error ?? cloud.error ?? sync.error, entry, sync.data?.state);
  const showProgress = downloading && !deleting && !failure && entry?.presence !== "downloaded";
  const showDownload = !receipt && !deleting && entry?.presence !== "removing";

  return {
    id,
    name,
    entry,
    receipt,
    account,
    scope,
    deleting,
    downloading,
    download,
    sync,
    refresh,
    setDeletionScope,
    back,
    backButton,
    failure,
    showProgress,
    showDownload,
  };
};

export const CloudProjectChoice = ({ input }: { input: WorkbenchPanelRenderInput }) => {
  const {
    id,
    name,
    entry,
    receipt,
    account,
    scope,
    deleting,
    downloading,
    download,
    sync,
    refresh,
    setDeletionScope,
    back,
    backButton,
    failure,
    showProgress,
    showDownload,
  } = useCloudProjectChoice(input);

  return (
    <Stack gap="md" p="md">
      <Text as="h2" textStyle="heading/M">
        {name}
      </Text>
      {showProgress && (
        <HStack role="status">
          <Spinner size="sm" />
          <Text>{sync.data?.offlineReady ? "Preparing project folder" : "Downloading project"}</Text>
        </HStack>
      )}
      {!downloading && entry?.presence === "cloud-only" && <Text>Cloud only</Text>}
      {entry?.presence === "removing" && <Text>Local removal needs attention.</Text>}
      {entry && !entry.online && <Text color="fg.muted">Connect to Cloud to download or delete this project.</Text>}
      {failure && (
        <AlertMessage status="error" compact role="alert">
          {failure}
        </AlertMessage>
      )}
      <HStack gap="sm" justify="space-between" align="start" flexWrap="wrap">
        <Stack gap="sm">
          {entry?.presence === "removing" && (
            <LocalProjectRemoval id={id} name={name} account={account} pending onRemoved={() => void refresh()} />
          )}
          {(deleting || receipt || entry?.presence === "cloud-only") && (
            <CloudProjectDeletionAction
              id={id}
              name={name}
              account={account}
              receipt={receipt}
              canDelete={Boolean(entry?.actions.deleteCloud)}
              cloudOnly
              key={scope}
              onSubmitted={() => setDeletionScope(scope)}
              onCompleted={back}
            />
          )}
        </Stack>
        <HStack gap="sm">
          <Button ref={backButton} variant="ghost" size="sm" onClick={back}>
            Back
          </Button>
          {showDownload && (
            <Button
              size="sm"
              disabled={!entry?.actions.download || (!downloading && download.isPending)}
              loading={download.isPending}
              onClick={() => download.mutate()}
            >
              {downloading || download.error ? "Retry" : "Download"}
            </Button>
          )}
        </HStack>
      </HStack>
    </Stack>
  );
};
