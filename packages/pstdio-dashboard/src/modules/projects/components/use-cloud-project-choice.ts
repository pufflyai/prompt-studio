import type { CloudProjectCatalogEntry, DeviceLogin, ProjectCopyAccount, ProjectSyncStatus } from "@pstdio/sdk/client";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { useCollectionSelection } from "@/lib/sync/use-collection-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { cloudCopyDownloadAction, getCloudCopyDownloads } from "../data/cloud-copy-download";
import { useCloudLocalRemoval } from "../data/cloud-local-removal";
import { useCloudProjectDeletions } from "../data/cloud-project-deletion-operations";
import { cloudProjectCatalogKey, useCloudProjectCatalog } from "../data/project-catalog";
import { cloudCopySyncKey, projectCopyScopeKey } from "../data/project-copy-scope";
import { findDashboardProject } from "../data/project-data";
import { type DownloadOwner, useCloudCopyIntent } from "./use-cloud-copy-intent";
import { useRecoveredProjectOpening } from "./use-recovered-project-opening";

const useCloudCopyDownload = (
  input: WorkbenchPanelRenderInput,
  options: {
    id: string;
    downloading: boolean;
    invalidated: boolean;
    copyBusy: boolean;
    accountUnconfirmed: boolean;
    localRemoval: ReturnType<typeof useCloudLocalRemoval>;
    deleting: boolean;
    entry?: CloudProjectCatalogEntry;
    account?: ProjectCopyAccount;
    login?: DeviceLogin;
    owner: DownloadOwner;
    rememberIntent: (previous: DownloadOwner, admitted: DownloadOwner) => void;
    discardIntent: (admitted: DownloadOwner) => void;
    retireIntent: (scope: string) => void;
    scope: string;
  },
) => {
  const {
    id,
    downloading,
    invalidated,
    copyBusy,
    accountUnconfirmed,
    localRemoval,
    deleting,
    entry,
    account,
    login,
    owner,
    rememberIntent,
    discardIntent,
    retireIntent,
    scope,
  } = options;
  const runtime = getRuntimeCollections();
  const client = getRuntimeApiClient(runtime);
  const operations = getCloudCopyDownloads(runtime);
  useSyncExternalStore(operations.subscribe, operations.snapshot, operations.snapshot);
  const { active, failure: unresolved } = operations.state(id, account, login);
  const queryClient = useQueryClient();
  useCollectionSelection({ tables: ["projects", "workspaces"] });
  const localName = findDashboardProject(id)?.name;
  const sync = useQuery({
    queryKey: cloudCopySyncKey(scope),
    queryFn: ({ signal }) =>
      client.account.projectSyncStatus(id, {
        signal,
        expected: login && { accountId: login.accountId, managerOrigin: login.managerOrigin },
      }),
    enabled: downloading && Boolean(localName && account),
    retry: false,
    refetchInterval: 1500,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: cloudProjectCatalogKey });
  const action = cloudCopyDownloadAction(entry, sync.data);
  const download = useMutation({
    mutationFn: (admission: {
      id: string;
      account: ProjectCopyAccount;
      login: DeviceLogin;
      owner: DownloadOwner;
      action: NonNullable<ReturnType<typeof cloudCopyDownloadAction>>;
    }) => {
      const admitted = { scope: admission.owner.scope, requested: true };
      return operations.start(
        admission.id,
        admission.account,
        admission.login,
        admission.action,
        () => rememberIntent(admission.owner, admitted),
        () => discardIntent(admitted),
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
    if (removedScope !== owner.scope) return;
    retireIntent(removedScope);
    resetDownload();
  });
  useEffect(() => operations.subscribeToLocalRemoval((removedScope) => retireRemovedCopy(removedScope)), [operations]);

  // Native recovery can finish without a Download request from this modal.
  const ready =
    !invalidated &&
    !accountUnconfirmed &&
    !owner.retired &&
    !deleting &&
    !localRemoval.isRemoving(id, account, login) &&
    (!copyBusy || Boolean(active)) &&
    entry?.presence === "downloaded";
  useRecoveredProjectOpening(input, scope, { id, name: localName, ready, account, login, localRemoval });

  const checkedDownload = useRef<symbol>(undefined);
  const statusObserved =
    entry?.presence === "downloaded" || Boolean(entry?.downloadError) || entry?.presence === "downloading";
  useEffect(() => {
    if (accountUnconfirmed || !statusObserved || !unresolved?.canCheck || checkedDownload.current === unresolved.id)
      return;
    checkedDownload.current = unresolved.id;
    void operations.check(unresolved.id);
  }, [accountUnconfirmed, statusObserved, operations, unresolved?.id, unresolved?.canCheck]);

  const requestDownload = () => {
    const current = operations.state(id, account, login);
    if (action && account && login && !current.active && !current.failure)
      download.mutate({ id, account, login, owner, action });
  };
  const checkDownload = async () => {
    if (
      unresolved?.canCheck &&
      operations.isCurrent(id, account, login) &&
      operations.state(id, account, login).failure?.id === unresolved.id
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
      !account ||
      !login ||
      !canDiscard ||
      !operations.isCurrent(id, account, login) ||
      operations.state(id, account, login).failure?.id !== unresolved.id
    )
      return;
    if (operations.discard(id, account, login, unresolved.id)) download.reset();
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

const useCloudChoiceInvalidation = (input: WorkbenchPanelRenderInput, scope: string, known: boolean) => {
  const [admittedScope, setAdmittedScope] = useState<string>();
  if (known && admittedScope === undefined) setAdmittedScope(scope);
  const invalidated = known && admittedScope !== undefined && admittedScope !== scope;
  useEffect(() => {
    if (invalidated) input.workbench.overlays.closeOverlay(input.instance.instanceId);
  }, [invalidated, input.workbench, input.instance.instanceId]);
  return invalidated;
};

export const useCloudProjectChoice = (input: WorkbenchPanelRenderInput) => {
  const id = input.instance.resource?.id ?? "";
  const selectedAccount = input.instance.pageContext?.params?.accountId;
  const cloud = useCloudProjectCatalog(typeof selectedAccount === "string" ? selectedAccount : undefined, id);
  const entry = cloud.data?.projects.find((entry) => entry.id === id);
  const receipt = cloud.data?.deletions.find((entry) => entry.projectId === id);
  const account = cloud.data?.account;
  const login = cloud.login ?? undefined;
  const name = entry?.name ?? receipt?.name ?? input.instance.title ?? id;
  const invalidated = useCloudChoiceInvalidation(input, cloud.scope, cloud.accountKnown);
  const scopeAccount = login && { managerOrigin: login.managerOrigin, accountId: cloud.accountId ?? login.accountId };
  const copyScope = projectCopyScopeKey(getRuntimeCollections(), id, login, scopeAccount);
  const { scope, owner, requested, rememberIntent, discardIntent, retireIntent } = useCloudCopyIntent(
    copyScope,
    cloud.accountKnown,
  );
  const [deletionScope, setDeletionScope] = useState<string>();
  const deletion = useCloudProjectDeletions();
  const localRemoval = useCloudLocalRemoval();
  const copyBusy = localRemoval.active(id, account, login);
  const deleting = Boolean(receipt || deletionScope === scope || deletion.active(id, account));
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
      invalidated,
      copyBusy,
      accountUnconfirmed: cloud.accountUnconfirmed,
      localRemoval,
      deleting,
      entry,
      account,
      login,
      owner,
      rememberIntent,
      discardIntent,
      retireIntent,
      scope,
    });
  const { refetch: refetchCatalog, isRefetchError } = cloud;
  const checkingAvailability = isRefetchError && entry?.actions.download === false;
  useEffect(() => {
    if ((!requested && !checkingAvailability) || invalidated || deleting || entry?.presence !== "cloud-only") return;
    const timer = setInterval(() => {
      void refetchCatalog({ cancelRefetch: false });
    }, 1500);
    return () => clearInterval(timer);
  }, [requested, checkingAvailability, invalidated, deleting, entry?.presence, refetchCatalog]);
  const back = () => {
    input.workbench.overlays.closeOverlay(input.instance.instanceId);
    void input.workbench.commands.executeCommand(dashboardCommandIds.openProjects);
  };

  const sharedError = unresolved?.error instanceof Error ? unresolved.error : undefined;
  const requestError = entry?.presence === "downloading" ? null : (download.error ?? sharedError ?? null);
  const failure = downloadMessage(requestError ?? cloud.error ?? sync.error, entry, sync.data);
  const pending = Boolean(active && !unresolved);
  const downloadInProgress = downloading || pending;
  const showProgress = downloadInProgress && !deleting && !failure && entry?.presence !== "downloaded";
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
    login,
    scope,
    deleting,
    downloading: downloadInProgress,
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
    requestDownload,
    checkDownload,
    discardDownload,
  };
};
