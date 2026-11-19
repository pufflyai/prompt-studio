import type { CloudProjectCatalogEntry, ProjectCopyAccount } from "@pstdio/sdk/client";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { useCollectionSelection } from "@/lib/sync/use-collection-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { cloudProjectCatalogKey, useCloudProjectCatalog } from "../data/project-catalog";
import { findDashboardProject } from "../data/project-data";

type DownloadOwner = { scope: string; requested: boolean };

const useCloudCopyDownload = (
  input: WorkbenchPanelRenderInput,
  options: {
    id: string;
    downloading: boolean;
    requested: boolean;
    deleting: boolean;
    entry?: CloudProjectCatalogEntry;
    account?: ProjectCopyAccount;
    owner: DownloadOwner;
    rememberIntent: (owner: DownloadOwner) => void;
    scope: string;
  },
) => {
  const { id, downloading, requested, deleting, entry, account, owner, rememberIntent, scope } = options;
  const client = getRuntimeApiClient(getRuntimeCollections());
  const queryClient = useQueryClient();
  useCollectionSelection({ tables: ["projects", "workspaces"] });
  const localName = findDashboardProject(id)?.name;
  const sync = useQuery({
    queryKey: ["cloud-project-opening", scope],
    queryFn: ({ signal }) => client.account.projectSyncStatus(id, { signal, expected: account }),
    enabled: downloading && Boolean(localName && account),
    retry: false,
    refetchInterval: 1500,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: cloudProjectCatalogKey });
  const download = useMutation({
    mutationFn: (admission: {
      id: string;
      account?: ProjectCopyAccount;
      owner: DownloadOwner;
      client: typeof client;
    }) => {
      if (!admission.account) throw new Error("The active Cloud account changed. Choose the project again.");
      return admission.client.account.downloadCloudProject(admission.id, { expected: admission.account });
    },
    onSettled() {
      void refresh();
    },
  });

  const resetDownload = download.reset;
  const downloadScope = download.variables?.owner.scope;
  useEffect(() => {
    if (downloadScope && downloadScope !== scope) resetDownload();
  }, [downloadScope, scope, resetDownload]);

  useEffect(() => {
    if (!requested || entry?.presence !== "downloaded" || !localName || deleting) return;
    input.workbench.overlays.closeOverlay(input.instance.instanceId);
    void input.workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
      project: { id, name: localName },
    });
  }, [entry?.presence, id, input.instance.instanceId, input.workbench, requested, localName, deleting]);

  const requestDownload = () => {
    rememberIntent(owner);
    download.mutate({ id, account, owner, client });
  };
  return { sync, download, refresh, requestDownload };
};

const downloadMessage = (error: Error | null, entry?: CloudProjectCatalogEntry, syncState?: string) => {
  if (error) return error.message;
  if (entry?.downloadError) return entry.downloadError;
  if (syncState === "needs-attention") return "Cloud download needs attention. Retry to continue.";
};

export const useCloudProjectChoice = (input: WorkbenchPanelRenderInput) => {
  const id = input.instance.resource?.id ?? "";
  const cloud = useCloudProjectCatalog();
  const entry = cloud.data?.projects.find((entry) => entry.id === id);
  const receipt = cloud.data?.deletions.find((entry) => entry.projectId === id);
  const account = cloud.data?.account;
  const name = entry?.name ?? receipt?.name ?? input.instance.title ?? id;
  const [admittedScope, setAdmittedScope] = useState<string>();
  if (cloud.accountKnown && admittedScope === undefined) setAdmittedScope(cloud.scope);
  const invalidated = cloud.accountKnown && admittedScope !== undefined && admittedScope !== cloud.scope;
  useEffect(() => {
    if (invalidated) input.workbench.overlays.closeOverlay(input.instance.instanceId);
  }, [invalidated, input.workbench, input.instance.instanceId]);
  const scope = JSON.stringify([id, cloud.scope]);
  const [owner, setOwner] = useState<DownloadOwner>({ scope, requested: false });
  if (owner.scope !== scope) setOwner({ scope, requested: false });
  const requested = owner.scope === scope && owner.requested;
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
  const { sync, download, refresh, requestDownload } = useCloudCopyDownload(input, {
    id,
    downloading,
    requested,
    deleting,
    entry,
    account,
    owner,
    rememberIntent: (admitted) =>
      setOwner((current) => (current === admitted ? { ...current, requested: true } : current)),
    scope,
  });
  const refetchCatalog = cloud.refetch;
  useEffect(() => {
    if (!requested || invalidated || deleting || entry?.presence !== "cloud-only") return;
    const timer = setInterval(() => {
      void refetchCatalog({ cancelRefetch: false });
    }, 1500);
    return () => clearInterval(timer);
  }, [requested, invalidated, deleting, entry?.presence, refetchCatalog]);
  const back = () => {
    input.workbench.overlays.closeOverlay(input.instance.instanceId);
    void input.workbench.commands.executeCommand(dashboardCommandIds.openProjects);
  };

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
    invalidated,
    requestDownload,
  };
};
