import type {
  CloudProjectCatalog,
  CloudProjectCatalogEntry,
  DeleteCloudProjectInput,
  DownloadCloudProjectResult,
  ProjectCopyAccount,
  ProjectSyncStatus,
} from "pstdio-api-contracts";
import { identitySchema, projectDeletionStatusSchema } from "pstdio-sync-contracts";
import type { RouteDeps } from "../../features/deps";
import { apiLogger } from "../../lib/logger";
import { createLocalProjectRemoval, type ProjectCopyHooks, requireProjectCopyAccount } from "./local-project-removal";
import { readManagerAccount } from "./manager-account";
import { ManagerRequestDenied } from "./manager-client";
import { AccountRequestError } from "./native-account";
import type { createNativeManagerCall } from "./native-manager-call";
import type { DeviceLogin } from "./native-store";
import { createProjectCopyStore, type ProjectCopy, projectCopyAccount } from "./project-copy-store";

const projectDeletionPath = (id: string) => `/v1/workbenches/${encodeURIComponent(identitySchema.parse(id))}/deletion`;

const deletionReceipt = (input: unknown) => {
  const { workbenchId, ...deletion } = projectDeletionStatusSchema.parse(input);
  return { ...deletion, projectId: workbenchId };
};

interface CatalogInput {
  accountFile: string;
  login: () => Promise<DeviceLogin | null>;
  cloud: (login: DeviceLogin) => Awaited<ReturnType<typeof readManagerAccount>> | undefined;
  projects: Pick<RouteDeps["projectService"], "get">;
  online: () => boolean;
  syncStatus: (id: string) => Promise<ProjectSyncStatus>;
  call: ReturnType<typeof createNativeManagerCall>;
  refresh: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  withdraw?: (id: string) => Promise<void>;
  changed?: () => void;
}

export const createProjectCloudCatalog = (input: CatalogInput) => {
  const copies = createProjectCopyStore(input.accountFile);
  let projectCopies: ProjectCopyHooks | undefined;
  const preparingFolders = new Set<string>();
  const knownCloud = async (login: DeviceLogin) => input.cloud(login) ?? (await copies.roster(login));

  const entry = async (
    id: string,
    choice: ProjectCopy | undefined,
    online: boolean,
    cloudDeletion: boolean,
  ): Promise<CloudProjectCatalogEntry | undefined> => {
    const project = await input.projects.get(id);
    if (!project && !choice) return;
    const name = choice?.name ?? project!.name;
    const sync = project && !choice ? await input.syncStatus(id).catch(() => undefined) : undefined;
    const presence = choice?.phase ?? (sync?.offlineReady ? "downloaded" : "downloading");
    return {
      id,
      name,
      presence,
      online,
      actions: {
        removeLocal: presence === "removing" || Boolean(project && !choice),
        download: online && (presence === "cloud-only" || presence === "downloading"),
        deleteCloud: online && cloudDeletion,
      },
    };
  };

  const requireDevice = async () => {
    const login = await input.login();
    if (!login) throw new AccountRequestError("Log in before managing a cloud project");
    return login;
  };

  const requireCurrent = async (login: DeviceLogin) => {
    if ((await input.login())?.token !== login.token)
      throw new AccountRequestError("The active account changed before the request completed");
  };

  const removal = createLocalProjectRemoval({
    copies,
    login: requireDevice,
    requireCurrent,
    project: input.projects.get,
    isCloudProject: async (login, id) => Boolean((await knownCloud(login))?.ids.includes(id)),
    online: input.online,
    syncStatus: input.syncStatus,
    withdraw: input.withdraw ?? (async () => {}),
    changed: input.changed ?? (() => {}),
  });
  return {
    async readCloud(login: DeviceLogin, signal: AbortSignal) {
      const { ids, deletions, projectDeletion, ...account } = await readManagerAccount(login, signal);
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
    downloadCloudProject: (id: string): Promise<DownloadCloudProjectResult> =>
      removal.serialize(id, async () => {
        const login = await requireDevice();
        const cloud = input.cloud(login);
        if (!input.online() || !cloud?.ids.includes(id))
          throw new AccountRequestError("Connect to Cloud before downloading this project");
        const choice = (await copies.forAccount(login)).find((row) => row.projectId === id);
        if (choice?.phase === "removing") throw new AccountRequestError("Finish removing the local copy first");
        if (!choice) {
          const project = await input.projects.get(id);
          if (project && (await input.syncStatus(id)).offlineReady) return { projectId: id, presence: "downloaded" };
          void input.refresh();
          return { projectId: id, presence: "downloading" };
        }
        await requireCurrent(login);
        await copies.write({ ...choice, phase: "downloading" });
        void input
          .refresh()
          .then(async () => {
            if (await input.projects.get(id)) await input.retry(id);
          })
          .catch(() => {});
        return { projectId: id, presence: "downloading" };
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
          await projectCopies!.prepareFolder(id);
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
      const ids = cached
        ? new Set([
            ...cached.ids,
            ...remembered.filter((copy) => copy.phase === "removing").map((copy) => copy.projectId),
          ])
        : choices.keys();
      const projects = [];
      for (const id of ids) {
        const project = await entry(id, choices.get(id), online, Boolean(cached?.projectDeletion));
        if (project) projects.push(project);
      }
      const deletions = [];
      for (const operation of cached?.deletions ?? []) {
        const id = operation.workbenchId;
        const name = choices.get(id)?.name ?? (await input.projects.get(id))?.name ?? id;
        deletions.push({ ...deletionReceipt(operation), name });
      }
      await requireCurrent(login);
      return { account: projectCopyAccount(login), projects, deletions };
    },
    async cloudProjectDeletion(id: string, signal?: AbortSignal, expected?: ProjectCopyAccount) {
      const login = await requireDevice();
      requireProjectCopyAccount(login, expected);
      try {
        const status = await input.call(projectDeletionPath(id), undefined, login.token, signal);
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
        const status = await input.call(projectDeletionPath(id), { confirm: body.confirm }, login.token, signal);
        await requireCurrent(login);
        return deletionReceipt(status);
      } finally {
        // Discover accepted work even when the deletion reply was lost.
        void input.refresh();
      }
    },
  };
};
