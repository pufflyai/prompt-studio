import type {
  CloudProjectCatalog,
  CloudProjectCatalogEntry,
  DeleteCloudProjectInput,
  DownloadCloudProjectResult,
  LocalRemovalPreflight,
  ProjectCopyAccount,
  ProjectSyncStatus,
} from "pstdio-api-contracts";
import { identitySchema, projectDeletionStatusSchema } from "pstdio-sync-contracts";
import type { RouteDeps } from "../../features/deps";
import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "../relay/runtime";
import { createLocalProjectRemoval, type ProjectCopyHooks, requireProjectCopyAccount } from "./local-project-removal";
import { readManagerAccount } from "./manager-account";
import { ManagerRequestDenied } from "./manager-client";
import { AccountRequestError } from "./native-account";
import { matchesDeviceAccount } from "./native-device-read";
import type { createNativeManagerCall } from "./native-manager-call";
import type { DeviceLogin } from "./native-store";
import { createProjectCopyStore, type ProjectCopy, projectCopyAccount } from "./project-copy-store";

const projectDeletionPath = (id: string) => `/v1/workbenches/${encodeURIComponent(identitySchema.parse(id))}/deletion`;

const deletionReceipt = (input: unknown) => {
  const { workbenchId, ...deletion } = projectDeletionStatusSchema.parse(input);
  return { ...deletion, projectId: workbenchId };
};

const copyKey = (copy: Pick<ProjectCopy, "managerOrigin" | "accountId" | "deviceId" | "projectId">) =>
  JSON.stringify([copy.managerOrigin, copy.accountId, copy.deviceId, copy.projectId]);

interface CatalogInput {
  accountFile: string;
  login: () => Promise<DeviceLogin | null>;
  cloud: (login: DeviceLogin) => Awaited<ReturnType<typeof readManagerAccount>> | undefined;
  projects: Pick<RouteDeps["projectService"], "get">;
  online: () => boolean;
  syncStatus: (id: string) => Promise<ProjectSyncStatus>;
  returnedUploadState: (id: string) => Promise<LocalRemovalPreflight["uploadState"]>;
  call: ReturnType<typeof createNativeManagerCall>;
  refresh: () => Promise<void>;
  retry: (id: string, requireCurrent: () => Promise<void>) => Promise<void>;
  withdraw?: (id: string) => Promise<void>;
  changed?: () => void;
}

const createCatalogEntry =
  (input: Pick<CatalogInput, "projects" | "syncStatus">, folderErrors: Map<string, string>) =>
  async (
    id: string,
    choice: ProjectCopy | undefined,
    online: boolean,
    member: boolean,
    cloudDeletion: boolean,
    retrying: () => boolean,
  ): Promise<CloudProjectCatalogEntry | undefined> => {
    const project = await input.projects.get(id);
    if (!project && !choice && !member) return;
    const name = choice?.name ?? project?.name ?? id;
    const sync = project && !choice ? await input.syncStatus(id).catch(() => undefined) : undefined;
    const presence = choice?.phase ?? (sync?.offlineReady ? "downloaded" : "downloading");
    return {
      id,
      name,
      presence,
      online,
      downloadError: choice?.phase === "downloading" ? folderErrors.get(copyKey(choice)) : undefined,
      actions: {
        removeLocal: presence === "removing" || Boolean(member && project && !choice),
        download: online && member && !retrying() && (presence === "cloud-only" || presence === "downloading"),
        deleteCloud: online && member && cloudDeletion,
      },
    };
  };

const requireOnlineProject = (input: Pick<CatalogInput, "online" | "cloud">, login: DeviceLogin, id: string) => {
  if (!input.online() || !input.cloud(login)?.ids.includes(id))
    throw new AccountRequestError("Connect to Cloud before downloading this project");
};

const createCopyRetries = (
  input: Pick<CatalogInput, "refresh" | "projects" | "online" | "cloud" | "retry" | "changed">,
  requireCurrent: (login: DeviceLogin) => Promise<void>,
) => {
  const pending = new Set<string>();
  const keyFor = (login: DeviceLogin, id: string) => copyKey({ ...login, projectId: id });
  return {
    active: (login: DeviceLogin, id: string) => pending.has(keyFor(login, id)),
    start(login: DeviceLogin, id: string) {
      const key = keyFor(login, id);
      const requireRetryScope = async () => {
        await requireCurrent(login);
        requireOnlineProject(input, login, id);
      };
      pending.add(key);
      void input
        .refresh()
        .then(async () => {
          if (!(await input.projects.get(id))) return;
          await requireRetryScope();
          await input.retry(id, requireRetryScope);
        })
        .catch(() => {})
        .finally(() => {
          pending.delete(key);
          input.changed?.();
        });
    },
  };
};

const requestDiscoveredCopy = async (
  input: Pick<CatalogInput, "projects" | "refresh" | "syncStatus">,
  id: string,
  retry: () => Promise<void>,
) => {
  const local = await input.projects.get(id);
  const status = local ? await input.syncStatus(id) : undefined;
  if (status?.offlineReady) return { projectId: id, presence: "downloaded" as const };
  if (status?.state === "needs-attention") await retry();
  else void input.refresh();
  return { projectId: id, presence: "downloading" as const };
};

const storedCopyNeedsRetry = async (input: Pick<CatalogInput, "projects" | "syncStatus">, copy: ProjectCopy) => {
  if (copy.phase !== "downloading" || !(await input.projects.get(copy.projectId))) return false;
  const status = await input.syncStatus(copy.projectId).catch(() => undefined);
  return status?.state === "needs-attention";
};

const createCopySyncStatus =
  (copies: ReturnType<typeof createProjectCopyStore>, retries: ReturnType<typeof createCopyRetries>) =>
  async (id: string, login: DeviceLogin | null, read: () => Promise<ProjectSyncStatus>) => {
    const pendingRetry = login && retries.active(login, id);
    const status = await read();
    if (login && status.state === "needs-attention" && (pendingRetry || retries.active(login, id)))
      return { ...status, state: "first-download-incomplete" as const, offlineReady: false };
    if (!login || status.state !== "local") return status;
    const choice = (await copies.forAccount(login)).find((row) => row.projectId === id);
    return choice?.phase === "downloading"
      ? { state: "first-download-incomplete" as const, offlineReady: false }
      : status;
  };

export const createProjectCloudCatalog = (input: CatalogInput) => {
  const copies = createProjectCopyStore(input.accountFile);
  let projectCopies: ProjectCopyHooks | undefined;
  const preparingFolders = new Set<string>();
  const folderErrors = new Map<string, string>();
  const knownCloud = async (login: DeviceLogin) => input.cloud(login) ?? (await copies.roster(login));

  const entry = createCatalogEntry(input, folderErrors);

  const requireDevice = async () => {
    const login = await input.login();
    if (!login) throw new AccountRequestError("Log in before managing a cloud project");
    return login;
  };

  const requireCurrent = async (login: DeviceLogin) => {
    const current = await input.login();
    if (
      !current ||
      current.token !== login.token ||
      current.deviceId !== login.deviceId ||
      !matchesDeviceAccount(current, login)
    )
      throw new AccountRequestError("The active account changed before the request completed");
  };

  const retries = createCopyRetries(input, requireCurrent);
  const removal = createLocalProjectRemoval({
    copies,
    login: requireDevice,
    requireCurrent,
    project: input.projects.get,
    isCloudProject: async (login, id) => Boolean((await knownCloud(login))?.ids.includes(id)),
    online: input.online,
    syncStatus: input.syncStatus,
    returnedUploadState: input.returnedUploadState,
    withdraw: input.withdraw ?? (async () => {}),
    changed: input.changed ?? (() => {}),
  });
  return {
    async acceptsRelayWorkbench(connection: RelayWorkbench) {
      const choices = await copies.forAccount({
        managerOrigin: connection.managerOrigin,
        accountId: connection.accountId,
        deviceId: connection.environmentId,
      });
      const copy = choices.find((copy) => copy.projectId === connection.workbenchId);
      return !copy || copy.phase === "downloading";
    },
    knownProjectIds: async (login: DeviceLogin) => (await knownCloud(login))?.ids,
    async readCloud(login: DeviceLogin, signal: AbortSignal) {
      const { ids, deletions: discovered, projectDeletion, ...account } = await readManagerAccount(login, signal);
      const deletions = discovered ?? (await knownCloud(login))?.deletions ?? [];
      await requireCurrent(login);
      await copies
        .rememberRoster(login, { ids, deletions, projectDeletion })
        .catch((error) =>
          apiLogger.warn(
            { event: "account.cloud_catalog.persist_failed", error },
            "Could not save the offline Cloud catalog",
          ),
        );
      return { ids, deletions, projectDeletion, ...account };
    },
    connectProjectCopies(hooks: ProjectCopyHooks) {
      projectCopies = hooks;
      removal.connect(hooks);
    },
    inspectLocalRemoval: removal.preflight,
    removeLocalProject: removal.remove,
    restoreLocalRemovalBarrier: removal.restoreBarrier,
    resumeLocalRemovals: removal.resume,
    closeLocalRemovals: removal.close,
    async recordCloudDiscovery(connection: RelayWorkbench, name: string) {
      const login = await requireDevice();
      const { workbenchId: projectId, accountId, managerOrigin, environmentId: deviceId } = connection;
      requireProjectCopyAccount(login, { accountId, managerOrigin });
      if (login.deviceId !== deviceId || login.token !== connection.renewalGrant)
        throw new AccountRequestError("The active device changed during Cloud discovery");
      const admitted = await copies.recordDiscovery({
        accountId,
        managerOrigin,
        deviceId,
        projectId,
        name,
        phase: "downloading",
        automatic: true,
      });
      if (!admitted) throw new AccountRequestError("This device removed its copy of the project");
    },
    fenceLocalStatus: createCopySyncStatus(copies, retries),
    downloadCloudProject: (id: string, expected?: ProjectCopyAccount): Promise<DownloadCloudProjectResult> =>
      removal.serialize(id, async () => {
        const login = await requireDevice();
        requireProjectCopyAccount(login, expected);
        requireOnlineProject(input, login, id);
        const choice = (await copies.forAccount(login)).find((row) => row.projectId === id);
        if (choice?.phase === "removing") throw new AccountRequestError("Finish removing the local copy first");
        const downloading = { projectId: id, presence: "downloading" } as const;
        if (retries.active(login, id)) return downloading;
        if (!choice)
          return requestDiscoveredCopy(input, id, async () => {
            await requireCurrent(login);
            requireOnlineProject(input, login, id);
            retries.start(login, id);
          });
        const needsRetry = await storedCopyNeedsRetry(input, choice);
        await requireCurrent(login);
        requireOnlineProject(input, login, id);
        folderErrors.delete(copyKey(choice));
        // Explicit Download still prepares a folder when an automatic discovery finishes.
        if (choice.automatic || choice.phase === "cloud-only")
          await copies.write({ ...choice, phase: "downloading", automatic: undefined });
        if (needsRetry) retries.start(login, id);
        else void input.refresh();
        return downloading;
      }),
    async prepareDownloadedProject(id: string) {
      if (!projectCopies || preparingFolders.has(id)) return;
      preparingFolders.add(id);
      try {
        await removal.serialize(id, async () => {
          const login = await input.login();
          if (!login || !input.cloud(login)?.ids.includes(id)) return;
          const choice = (await copies.forAccount(login)).find((row) => row.projectId === id);
          if (choice?.phase !== "downloading" || !(await input.syncStatus(id)).offlineReady) return;
          await requireCurrent(login);
          if (!choice.automatic) {
            const key = copyKey(choice);
            if (folderErrors.has(key)) return;
            try {
              await projectCopies!.prepareFolder(id);
            } catch (error) {
              folderErrors.set(key, "Prompt Studio could not prepare the project folder. Retry to finish opening it.");
              input.changed?.();
              throw error;
            }
          }
          await requireCurrent(login);
          await copies.forget(choice);
          void input.refresh();
        });
      } finally {
        preparingFolders.delete(id);
      }
    },
    async withdrawnProjectIds(login: DeviceLogin) {
      const known = await copies.forAccount(login);
      return new Set(known.filter((copy) => copy.phase !== "downloading").map((copy) => copy.projectId));
    },
    async catalogProjects(): Promise<CloudProjectCatalog> {
      const login = await input.login();
      if (!login) return { projects: [], deletions: [] };
      const cached = await knownCloud(login);
      const online = Boolean(cached && input.online());
      const remembered = await copies.forAccount(login);
      const choices = new Map(remembered.map((copy) => [copy.projectId, copy]));
      const members = new Set(cached?.ids);
      const ids = new Set(members);
      for (const copy of remembered) {
        if (
          !cached ||
          copy.phase === "removing" ||
          (copy.phase === "downloading" && (await input.projects.get(copy.projectId)))
        )
          ids.add(copy.projectId);
      }
      const projects = [];
      for (const id of ids) {
        const project = await entry(
          id,
          choices.get(id),
          online,
          members.has(id),
          Boolean(cached?.projectDeletion),
          () => retries.active(login, id),
        );
        if (project) projects.push(project);
      }
      const deletions = [];
      for (const operation of cached?.deletions ?? []) {
        const id = operation.workbenchId;
        const name = choices.get(id)?.name ?? (await input.projects.get(id))?.name ?? id;
        deletions.push({ ...deletionReceipt(operation), name });
      }
      await requireCurrent(login);
      return { account: projectCopyAccount(login), membershipKnown: Boolean(cached), projects, deletions };
    },
    async cloudProjectDeletion(id: string, signal?: AbortSignal, expected?: ProjectCopyAccount) {
      const login = await requireDevice();
      requireProjectCopyAccount(login, expected);
      try {
        const status = await input.call(projectDeletionPath(id), undefined, login.token, signal, login);
        await requireCurrent(login);
        return deletionReceipt(status);
      } catch (error) {
        if (error instanceof ManagerRequestDenied && error.status === 404) return null;
        throw error;
      }
    },
    async deleteCloudProject(id: string, body: DeleteCloudProjectInput, signal?: AbortSignal) {
      const login = await requireDevice();
      requireProjectCopyAccount(login, body.expectedAccount);
      try {
        const status = await input.call(projectDeletionPath(id), { confirm: body.confirm }, login.token, signal, login);
        await requireCurrent(login);
        return deletionReceipt(status);
      } finally {
        // Discover accepted work even when the deletion reply was lost.
        void input.refresh();
      }
    },
  };
};
