import type { CloudProjectCatalogEntry, ProjectCopyAccount } from "@pstdio/sdk/client";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { useCollectionSelection } from "@/lib/sync/use-collection-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  type CloudCopyDownloadAdmission,
  cloudCopyDownloadAction,
  cloudCopyScopeFor,
  cloudCopySyncKey,
  getCloudCopyDownloads,
} from "../data/cloud-copy-download";
import { useCloudLocalRemoval } from "../data/cloud-local-removal";
import { useCloudProjectDeletions } from "../data/cloud-project-deletion-operations";
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
    clearIntent: () => void;
    scope: string;
  },
) => {
  const { id, downloading, requested, deleting, entry, account, owner, rememberIntent, clearIntent, scope } = options;
  const runtime = getRuntimeCollections();
  const client = getRuntimeApiClient(runtime);
  const operations = getCloudCopyDownloads(runtime);
  useSyncExternalStore(operations.subscribe, operations.snapshot, operations.snapshot);
  const { active, failure: unresolved } = operations.state(id);
  const queryClient = useQueryClient();
  useCollectionSelection({ tables: ["projects", "workspaces"] });
  const localName = findDashboardProject(id)?.name;
  const sync = useQuery({
    queryKey: cloudCopySyncKey(scope),
    queryFn: ({ signal }) => client.account.projectSyncStatus(id, { signal, expected: account }),
    enabled: downloading && Boolean(localName && account),
    retry: false,
    refetchInterval: 1500,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: cloudProjectCatalogKey });
  const download = useMutation({
    mutationFn: (request: { owner: DownloadOwner; admission: CloudCopyDownloadAdmission }) =>
      operations.start(request.admission, () => rememberIntent(request.owner)),
    onSettled(result, error) {
      if (result || error) void refresh();
    },
  });

  const resetDownload = download.reset;
  const downloadScope = download.variables?.owner.scope;
  useEffect(() => {
    if (downloadScope && downloadScope !== scope) resetDownload();
  }, [downloadScope, scope, resetDownload]);

  const retireRemovedCopy = useEffectEvent((removedScope: string) => {
    if (removedScope !== scope) return;
    clearIntent();
    resetDownload();
  });
  useEffect(() => operations.subscribeToLocalRemoval((removedScope) => retireRemovedCopy(removedScope)), [operations]);

  useEffect(() => {
    if (!requested || entry?.presence !== "downloaded" || !localName || deleting || !operations.isCurrent(id, scope))
      return;
    input.workbench.overlays.closeOverlay(input.instance.instanceId);
    void input.workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
      project: { id, name: localName },
    });
  }, [
    entry?.presence,
    id,
    input.instance.instanceId,
    input.workbench,
    requested,
    localName,
    deleting,
    operations,
    scope,
  ]);

  const checkedDownload = useRef<symbol>(undefined);
  const statusObserved =
    entry?.presence === "downloaded" || Boolean(entry?.downloadError) || entry?.presence === "downloading";
  useEffect(() => {
    if (!statusObserved || !unresolved?.canCheck || checkedDownload.current === unresolved.id) return;
    checkedDownload.current = unresolved.id;
    void operations.check(unresolved.id);
  }, [statusObserved, operations, unresolved?.id, unresolved?.canCheck]);

  const action = cloudCopyDownloadAction(entry, sync.data);
  const requestDownload = () => {
    const current = operations.state(id);
    if (action && !current.active && !current.failure) {
      download.mutate({ owner, admission: { id, account, scope, action } });
    }
  };
  const checkDownload = async () => {
    if (unresolved?.canCheck && operations.isCurrent(id, scope) && operations.state(id).failure?.id === unresolved.id)
      await operations.check(unresolved.id);
  };
  const discardDownload = () => {
    if (
      !unresolved ||
      entry?.presence !== "cloud-only" ||
      !operations.isCurrent(id, scope) ||
      operations.state(id).failure?.id !== unresolved.id
    )
      return;
    operations.discard(id, unresolved.id);
    download.reset();
    clearIntent();
  };
  return {
    sync,
    download,
    refresh,
    requestDownload,
    checkDownload: unresolved?.canCheck ? checkDownload : undefined,
    discardDownload: unresolved && entry?.presence === "cloud-only" ? discardDownload : undefined,
    action,
    active,
    unresolved,
  };
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
  const scope = cloudCopyScopeFor(id, cloud.scope);
  const [owner, setOwner] = useState<DownloadOwner>({ scope, requested: false });
  if (owner.scope !== scope) setOwner({ scope, requested: false });
  const requested = owner.scope === scope && owner.requested;
  const [deletionScope, setDeletionScope] = useState<string>();
  const deletion = useCloudProjectDeletions();
  const copyBusy = useCloudLocalRemoval().active(id);
  const deleting = Boolean(receipt || deletionScope === scope || deletion.active(id));
  useEffect(() => {
    if (receipt) setDeletionScope(scope);
  }, [receipt, scope]);
  const backButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backButton.current?.focus();
  }, []);
  const downloading = requested || entry?.presence === "downloading";
  const { sync, download, refresh, requestDownload, checkDownload, discardDownload, action, active, unresolved } =
    useCloudCopyDownload(input, {
      id,
      downloading,
      requested,
      deleting,
      entry,
      account,
      owner,
      rememberIntent: (admitted) =>
        setOwner((current) => (current === admitted ? { ...current, requested: true } : current)),
      clearIntent: () => setOwner((current) => (current.scope === scope ? { ...current, requested: false } : current)),
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

  const sharedError = unresolved?.error instanceof Error ? unresolved.error : undefined;
  const requestError = entry?.presence === "downloading" ? null : (download.error ?? sharedError ?? null);
  const failure = downloadMessage(requestError ?? cloud.error ?? sync.error, entry, sync.data?.state);
  const pending = Boolean(active && !unresolved);
  const showProgress = (downloading || pending) && !deleting && !failure && entry?.presence !== "downloaded";
  const canDownload = Boolean(
    action && !invalidated && !unresolved && !copyBusy && !deleting && (!downloading || failure),
  );
  const showDownload = !receipt && !deleting && entry?.presence !== "removing";

  return {
    id,
    name,
    entry,
    receipt,
    account,
    scope,
    deleting,
    downloading: downloading || pending,
    canDownload,
    downloadBlocking: Boolean(active),
    downloadPending: pending,
    sync,
    refresh,
    setDeletionScope,
    back,
    backButton,
    failure,
    showProgress,
    showDownload,
    invalidated,
    requestDownload: () => {
      if (canDownload) requestDownload();
    },
    checkDownload,
    discardDownload,
  };
};
