import type { CloudProjectCatalogEntry, DeviceLogin, ProjectCopyAccount } from "@pstdio/sdk/client";
import { useWorkbenchStore, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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

type DownloadOwner = { scope: string; requested: boolean; retired?: boolean };

const useRecoveredProjectOpening = (
  input: WorkbenchPanelRenderInput,
  scope: string,
  options: {
    id: string;
    name?: string;
    ready: boolean;
    account?: ProjectCopyAccount;
    login?: DeviceLogin;
    localRemoval: ReturnType<typeof useCloudLocalRemoval>;
  },
) => {
  const { id, name, ready, account, login, localRemoval } = options;
  const { workbench, instance } = input;
  const active = useWorkbenchStore(workbench.activation.store, (state) => state.active);
  const operations = getCloudCopyDownloads();
  const observing = useRef<ReturnType<typeof operations.observeOpening>>(undefined);
  const handled = useRef<string>(undefined);
  const eligible = useRef<{
    key: string;
    name: string;
    account: ProjectCopyAccount;
    device: DeviceLogin;
  }>(undefined);
  const openingKey = JSON.stringify([scope, instance.instanceId]);
  const canOpen = ready && Boolean(name && account && login);

  useLayoutEffect(() => {
    eligible.current =
      ready && name && account && login ? { key: openingKey, name, account, device: login } : undefined;
    return () => {
      eligible.current = undefined;
    };
  }, [account, login, name, openingKey, ready]);

  useEffect(() => {
    const opening = operations.observeOpening(scope);
    observing.current = opening;
    return () => {
      opening.release();
      observing.current = undefined;
    };
  }, [operations, scope]);

  useEffect(
    () =>
      operations.subscribeToLocalRemoval((removedScope) => {
        if (removedScope === scope && eligible.current?.key === openingKey) eligible.current = undefined;
      }),
    [openingKey, operations, scope],
  );

  useEffect(() => {
    if (!active || !canOpen || handled.current === openingKey) return;
    void observing.current?.open({
      id,
      read() {
        const current = eligible.current;
        if (
          current?.key !== openingKey ||
          !workbench.activation.isActive() ||
          handled.current === openingKey ||
          localRemoval.isRemoving(id, current.account, current.device)
        )
          return undefined;
        return current;
      },
      close() {
        handled.current = openingKey;
        workbench.overlays.closeOverlay(instance.instanceId);
      },
      select: (name) => workbench.commands.executeCommand(dashboardCommandIds.selectProject, { project: { id, name } }),
    });
  }, [active, canOpen, id, instance.instanceId, localRemoval, openingKey, workbench]);
};

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
    rememberIntent: (owner: DownloadOwner) => void;
    clearIntent: () => void;
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
    clearIntent,
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
    }) =>
      operations.start(admission.id, admission.account, admission.login, admission.action, () =>
        rememberIntent(admission.owner),
      ),
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
    operations.discard(id, account, login, unresolved.id);
    download.reset();
    clearIntent();
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

const downloadMessage = (error: Error | null, entry?: CloudProjectCatalogEntry, syncState?: string) => {
  if (error) return error.message;
  if (entry?.downloadError) return entry.downloadError;
  if (syncState === "needs-attention") return "Cloud download needs attention. Retry to continue.";
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
  const scope = projectCopyScopeKey(getRuntimeCollections(), id, login, account);
  const [owner, setOwner] = useState<DownloadOwner>({ scope, requested: false });
  if (owner.scope !== scope) setOwner({ scope, requested: false });
  const requested = owner.scope === scope && owner.requested;
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
      rememberIntent: (admitted) =>
        setOwner((current) => (current === admitted ? { scope, requested: true } : current)),
      clearIntent: () =>
        setOwner((current) => (current.scope === scope ? { scope, requested: false, retired: true } : current)),
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
  const failure = downloadMessage(requestError ?? cloud.error ?? sync.error, entry, sync.data?.state);
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
