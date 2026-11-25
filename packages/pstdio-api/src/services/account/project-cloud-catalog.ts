import type {
  CloudProjectCatalog,
  CloudProjectCatalogEntry,
  DownloadCloudProjectResult,
  LocalRemovalPreflight,
  ProjectCopyAccount,
  ProjectCopyDevice,
  ProjectSyncStatus,
} from "pstdio-api-contracts";
import type { RouteDeps } from "../../features/deps";
import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "../relay/runtime";
import { createCloudDeletionActions, deletionReceipt } from "./cloud-deletion-actions";
import {
  createLocalProjectRemoval,
  type ProjectCopyHooks,
  requireProjectCopyAccount,
  requireProjectCopyDevice,
} from "./local-project-removal";
import { readManagerAccount } from "./manager-account";
import { AccountRequestError } from "./native-account";
import { matchesDeviceAccount } from "./native-device-read";
import type { createNativeManagerCall } from "./native-manager-call";
import { type DeviceLogin, type ScopedDeviceLogin, scopeDeviceLogin, signedInIdentity } from "./native-store";
import {
  createCopyRetries,
  deviceProjectCopyKey,
  fenceCopySyncStatus,
  requestManualCopy,
  syncNeedsRetry,
} from "./project-copy-retry";
import { createProjectCopyStore, type ProjectCopy, projectCopyAccount } from "./project-copy-store";

interface CatalogInput {
  accountFile: string;
  login: () => Promise<DeviceLogin | null>;
  projectLogin?: (login: DeviceLogin, projectId: string) => Promise<ScopedDeviceLogin>;
  cloud: (login: ScopedDeviceLogin) => Awaited<ReturnType<typeof readManagerAccount>> | undefined;
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

const readCopyStatus = async (
  input: Pick<CatalogInput, "projects" | "syncStatus">,
  id: string,
  choice?: ProjectCopy,
) => {
  if (choice?.phase === "cloud-only" || !(await input.projects.get(id))) return;
  return input.syncStatus(id).catch(() => undefined);
};

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
      downloadError: choice?.phase === "downloading" ? folderErrors.get(deviceProjectCopyKey(choice, id)) : undefined,
      actions: {
        removeLocal: presence === "removing" || Boolean(member && project && !choice),
        download: online && member && !retrying() && (presence === "cloud-only" || presence === "downloading"),
        deleteCloud: online && member && cloudDeletion,
      },
    };
  };

const catalogProjectsForCopies = async (
  memberIds: string[] | undefined,
  remembered: ProjectCopy[],
  projectById: CatalogInput["projects"]["get"],
) => {
  const members = new Set(memberIds);
  const ids = new Set(members);
  for (const copy of remembered) {
    if (
      memberIds === undefined ||
      copy.phase === "removing" ||
      (copy.phase === "downloading" && (await projectById(copy.projectId)))
    )
      ids.add(copy.projectId);
  }
  return { ids, members };
};

const createCatalogReader =
  (input: {
    login: CatalogInput["login"];
    copies: ReturnType<typeof createProjectCopyStore>;
    knownCloud(
      login: ScopedDeviceLogin,
    ): Promise<
      Pick<NonNullable<ReturnType<CatalogInput["cloud"]>>, "deletions" | "ids" | "projectDeletion"> | undefined
    >;
    cloud: CatalogInput["cloud"];
    online: CatalogInput["online"];
    project: CatalogInput["projects"]["get"];
    entry: ReturnType<typeof createCatalogEntry>;
    retrying: (login: ScopedDeviceLogin, id: string) => boolean;
    requireCurrent(login: ScopedDeviceLogin): Promise<void>;
  }) =>
  async (accountId?: string, expectedDevice?: ProjectCopyDevice): Promise<CloudProjectCatalog> => {
    const {
      login: loginDevice,
      copies,
      knownCloud,
      cloud,
      online: isOnline,
      project: projectById,
      entry,
      requireCurrent,
    } = input;
    const device = await loginDevice();
    requireProjectCopyDevice(device, expectedDevice);
    if (!device) return { projects: [], deletions: [] };
    const login = scopeDeviceLogin(device, accountId);
    const cached = login.userId ? cloud(login) : await knownCloud(login);
    if (login.userId && !cached)
      return { account: projectCopyAccount(login), membershipKnown: false, projects: [], deletions: [] };
    const online = Boolean(cached && isOnline());
    const remembered = await copies.forAccount(login);
    const choices = new Map(remembered.map((copy) => [copy.projectId, copy]));
    const { ids, members } = await catalogProjectsForCopies(cached?.ids, remembered, projectById);
    const projects = [];
    for (const id of ids) {
      const project = await entry(id, choices.get(id), online, members.has(id), Boolean(cached?.projectDeletion), () =>
        input.retrying(login, id),
      );
      if (project) projects.push(project);
    }
    const deletions = [];
    for (const operation of cached?.deletions ?? []) {
      const id = operation.workbenchId;
      const name = choices.get(id)?.name ?? (await projectById(id))?.name ?? id;
      deletions.push({ ...deletionReceipt(operation), name });
    }
    await requireCurrent(login);
    const membershipKnown = login.userId ? Boolean(cloud(login)?.features.relay && online) : Boolean(cached);
    return { account: projectCopyAccount(login), membershipKnown, projects, deletions };
  };

export const createProjectCloudCatalog = (input: CatalogInput) => {
  const copies = createProjectCopyStore(input.accountFile);
  let projectCopies: ProjectCopyHooks | undefined;
  const preparingFolders = new Set<string>();
  const folderErrors = new Map<string, string>();
  const knownCloud = async (login: DeviceLogin) => input.cloud(login) ?? (await copies.roster(login));

  const entry = createCatalogEntry(input, folderErrors);

  const projectLogin = async (id?: string, expectedDevice?: ProjectCopyDevice) => {
    const login = await input.login();
    requireProjectCopyDevice(login, expectedDevice);
    if (!login || !id || !input.projectLogin) return login;
    return input.projectLogin(login, id);
  };
  const requireDevice = async (id?: string, expectedDevice?: ProjectCopyDevice): Promise<ScopedDeviceLogin> => {
    const login = await projectLogin(id, expectedDevice);
    if (!login) throw new AccountRequestError("Log in before managing a cloud project");
    return login;
  };

  const requireCurrent = async (login: ScopedDeviceLogin) => {
    const current = await input.login();
    if (
      !current ||
      current.token !== login.token ||
      current.deviceId !== login.deviceId ||
      !matchesDeviceAccount(current, signedInIdentity(login))
    )
      throw new AccountRequestError("The active account changed before the request completed");
  };

  const requireOnlineProject = (login: ScopedDeviceLogin, id: string) => {
    if (!input.online() || !input.cloud(login)?.ids.includes(id))
      throw new AccountRequestError("Connect to Cloud before downloading this project");
  };

  const requireCurrentProject = async (login: ScopedDeviceLogin, id: string) => {
    const current = await projectLogin(id);
    if (
      !current ||
      current.token !== login.token ||
      deviceProjectCopyKey(current, id) !== deviceProjectCopyKey(login, id)
    )
      throw new AccountRequestError("The active Cloud copy changed before the request completed");
    requireOnlineProject(login, id);
  };

  const retries = createCopyRetries({
    refresh: input.refresh,
    local: input.projects.get,
    retry: input.retry,
    requireCurrent: requireCurrentProject,
    changed: input.changed,
  });

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
        userId: connection.userId,
        deviceId: connection.environmentId,
      });
      const copy = choices.find((copy) => copy.projectId === connection.workbenchId);
      return !copy || copy.phase === "downloading";
    },
    knownProjectIds: async (login: DeviceLogin) => (await knownCloud(login))?.ids,
    async readCloud(login: ScopedDeviceLogin, signal: AbortSignal) {
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
      requireProjectCopyAccount(login, { accountId: connection.userId ?? accountId, managerOrigin });
      if (login.deviceId !== deviceId || login.token !== connection.renewalGrant)
        throw new AccountRequestError("The active device changed during Cloud discovery");
      const admitted = await copies.recordDiscovery({
        accountId,
        userId: connection.userId,
        managerOrigin,
        deviceId,
        projectId,
        name,
        phase: "downloading",
        automatic: true,
      });
      if (!admitted) throw new AccountRequestError("This device removed its copy of the project");
    },
    async fenceLocalStatus(id: string, login: DeviceLogin | null, read: () => Promise<ProjectSyncStatus>) {
      const scoped = login && ((await input.projectLogin?.(login, id)) ?? login);
      return fenceCopySyncStatus(id, scoped, read, copies, retries);
    },
    downloadCloudProject: (
      id: string,
      expected?: ProjectCopyAccount,
      expectedDevice?: ProjectCopyDevice,
    ): Promise<DownloadCloudProjectResult> =>
      removal.serialize(id, async () => {
        const login = await requireDevice(id, expectedDevice);
        requireProjectCopyAccount(login, expected);
        requireOnlineProject(login, id);
        const choice = (await copies.forAccount(login)).find((row) => row.projectId === id);
        if (choice?.phase === "removing") throw new AccountRequestError("Finish removing the local copy first");
        const downloading = { projectId: id, presence: "downloading" } as const;
        if (retries.active(login, id)) return downloading;
        const status = await readCopyStatus(input, id, choice);
        await requireCurrentProject(login, id);
        if (!choice && status?.offlineReady) return { projectId: id, presence: "downloaded" };
        await requestManualCopy(copies, folderErrors, choice);
        if (syncNeedsRetry(status)) retries.start(login, id);
        else void input.refresh();
        return downloading;
      }),
    async prepareDownloadedProject(id: string) {
      if (!projectCopies || preparingFolders.has(id)) return;
      preparingFolders.add(id);
      try {
        await removal.serialize(id, async () => {
          const login = await projectLogin(id);
          if (!login || !input.cloud(login)?.ids.includes(id)) return;
          const choice = (await copies.forAccount(login)).find((row) => row.projectId === id);
          if (choice?.phase !== "downloading" || !(await input.syncStatus(id)).offlineReady) return;
          await requireCurrent(login);
          if (!choice.automatic) {
            const key = deviceProjectCopyKey(choice, id);
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
    catalogProjects: createCatalogReader({
      login: input.login,
      copies,
      knownCloud,
      cloud: input.cloud,
      online: input.online,
      project: input.projects.get,
      entry,
      retrying: retries.active,
      requireCurrent,
    }),
    ...createCloudDeletionActions({ login: requireDevice, call: input.call, requireCurrent, refresh: input.refresh }),
  };
};
