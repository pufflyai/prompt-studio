import type { CloudProjectCatalogEntry, ProjectCopyAccount, ProjectSyncStatus } from "@pstdio/sdk/client";
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

const pickerCopyScope = (id: string, cloud: { scope: string; accountKnown: boolean }, admitted?: string) =>
  cloudCopyScopeFor(id, cloud.accountKnown ? cloud.scope : (admitted ?? cloud.scope));

const clearDownloadIntent = (current: DownloadOwner, scope: string, admitted?: DownloadOwner) =>
  (admitted ? current === admitted : current.scope === scope) ? { ...current, requested: false } : current;

const useCloudCopyDownload = (
  input: WorkbenchPanelRenderInput,
  options: {
    id: string;
    downloading: boolean;
    requested: boolean;
    deleting: boolean;
    accountUnconfirmed: boolean;
    localRemoval: ReturnType<typeof useCloudLocalRemoval>;
    entry?: CloudProjectCatalogEntry;
    account?: ProjectCopyAccount;
    owner: DownloadOwner;
    rememberIntent: (previous: DownloadOwner, admitted: DownloadOwner) => void;
    clearIntent: (admitted?: DownloadOwner) => void;
    scope: string;
  },
) => {
  const {
    id,
    downloading,
    requested,
    deleting,
    accountUnconfirmed,
    localRemoval,
    entry,
    account,
    owner,
    rememberIntent,
    clearIntent,
    scope,
  } = options;
  const runtime = getRuntimeCollections();
  const client = getRuntimeApiClient(runtime);
  const operations = getCloudCopyDownloads(runtime);
  useSyncExternalStore(operations.subscribe, operations.snapshot, operations.snapshot);
  const { active, failure: unresolved } = operations.state(id, scope);
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
    mutationFn: (request: { owner: DownloadOwner; admission: CloudCopyDownloadAdmission }) => {
      const admitted = { ...request.owner, requested: true };
      return operations.start(
        request.admission,
        () => rememberIntent(request.owner, admitted),
        () => clearIntent(admitted),
      );
    },
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

  const removing = localRemoval.isRemoving(id);
  useEffect(() => {
    if (
      !requested ||
      entry?.presence !== "downloaded" ||
      !localName ||
      deleting ||
      accountUnconfirmed ||
      removing ||
      localRemoval.isRemoving(id) ||
      !operations.isCurrent(id, scope) ||
      operations.isCheckingAccount()
    )
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
    accountUnconfirmed,
    removing,
    localRemoval,
    operations,
    scope,
  ]);

  const checkedDownload = useRef<symbol>(undefined);
  const statusObserved =
    entry?.presence === "downloaded" || Boolean(entry?.downloadError) || entry?.presence === "downloading";
  useEffect(() => {
    if (accountUnconfirmed || !statusObserved || !unresolved?.canCheck || checkedDownload.current === unresolved.id)
      return;
    checkedDownload.current = unresolved.id;
    void operations.check(unresolved.id);
  }, [accountUnconfirmed, statusObserved, operations, unresolved?.id, unresolved?.canCheck]);

  const action = cloudCopyDownloadAction(entry, sync.data);
  const requestDownload = () => {
    const current = operations.state(id, scope);
    if (action && !current.active && !current.failure) {
      download.mutate({ owner, admission: { id, account, scope, action } });
    }
  };
  const checkDownload = async () => {
    if (
      unresolved?.canCheck &&
      operations.isCurrent(id, scope) &&
      operations.state(id, scope).failure?.id === unresolved.id
    )
      await operations.check(unresolved.id);
  };
  const canDiscard = Boolean(
    !accountUnconfirmed &&
      unresolved &&
      (entry?.presence === "cloud-only" || (entry?.presence === "downloading" && unresolved.status === "unknown")),
  );
  const discardDownload = () => {
    if (
      !unresolved ||
      !canDiscard ||
      !operations.isCurrent(id, scope) ||
      operations.state(id, scope).failure?.id !== unresolved.id
    )
      return;
    if (!operations.discard(id, scope, unresolved.id)) return;
    download.reset();
  };
  return {
    sync,
    download,
    refresh,
    requestDownload,
    checkDownload: !accountUnconfirmed && unresolved?.canCheck ? checkDownload : undefined,
    discardDownload: canDiscard ? discardDownload : undefined,
    action,
    active,
    unresolved,
  };
};

const downloadMessage = (error: Error | null, entry?: CloudProjectCatalogEntry, sync?: ProjectSyncStatus) => {
  if (error) return error.message;
  if (entry?.downloadError) return entry.downloadError;
  if (sync?.state === "needs-attention" || sync?.sources?.some((source) => source.error))
    return "Cloud download needs attention. Retry to continue.";
};

const useCloudOnlyCatalogRefresh = (
  cloud: ReturnType<typeof useCloudProjectCatalog>,
  entry: CloudProjectCatalogEntry | undefined,
  { requested, invalidated, deleting }: { requested: boolean; invalidated: boolean; deleting: boolean },
) => {
  const { refetch, isRefetchError } = cloud;
  const checkingAvailability = isRefetchError && entry?.actions.download === false;
  const enabled = (requested || checkingAvailability) && !invalidated && !deleting && entry?.presence === "cloud-only";
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      void refetch({ cancelRefetch: false });
    }, 1500);
    return () => clearInterval(timer);
  }, [enabled, refetch]);
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
  const scope = pickerCopyScope(id, cloud, admittedScope);
  const [owner, setOwner] = useState<DownloadOwner>({ scope, requested: false });
  if (owner.scope !== scope) setOwner({ scope, requested: false });
  const requested = owner.scope === scope && owner.requested;
  const [deletionScope, setDeletionScope] = useState<string>();
  const deletion = useCloudProjectDeletions();
  const localRemoval = useCloudLocalRemoval();
  const copyBusy = localRemoval.active(id);
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
      accountUnconfirmed: cloud.accountUnconfirmed,
      localRemoval,
      entry,
      account,
      owner,
      rememberIntent: (previous, admitted) => setOwner((current) => (current === previous ? admitted : current)),
      clearIntent: (admitted) => setOwner((current) => clearDownloadIntent(current, scope, admitted)),
      scope,
    });
  useCloudOnlyCatalogRefresh(cloud, entry, { requested, invalidated, deleting });
  const back = () => {
    input.workbench.overlays.closeOverlay(input.instance.instanceId);
    void input.workbench.commands.executeCommand(dashboardCommandIds.openProjects);
  };

  const sharedError = unresolved?.error instanceof Error ? unresolved.error : undefined;
  const requestError = entry?.presence === "downloading" ? null : (download.error ?? sharedError ?? null);
  const failure = downloadMessage(requestError ?? cloud.error ?? sync.error, entry, sync.data);
  const pending = Boolean(active && !unresolved);
  const showProgress = (downloading || pending) && !deleting && !failure && entry?.presence !== "downloaded";
  const canDownload = Boolean(
    action &&
      !cloud.accountUnconfirmed &&
      !invalidated &&
      !unresolved &&
      !copyBusy &&
      !deleting &&
      (!downloading || failure),
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
