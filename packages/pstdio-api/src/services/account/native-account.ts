import { dirname, join } from "node:path";
import type {
  AccountSignInProvider,
  AccountStatus,
  DeviceCommand,
  ProjectReturnAction,
  ProjectSyncStatus,
} from "pstdio-api-contracts";
import type { Json } from "pstdio-sync-contracts";
import { identitySchema } from "pstdio-sync-contracts";
import type { RouteDeps } from "../../features/deps";
import { apiLogger } from "../../lib/logger";
import type { startFolderRecovery } from "../relay/folder-recovery";
import type { ProjectSyncRetry } from "../relay/project-sync-retry";
import type { RelayWorkbench } from "../relay/runtime";
import { createAccountRefresh, createAccountWatch } from "./account-refresh";
import { readAccountStatus } from "./account-status";
import { createDeviceIdentity } from "./device-identity";
import { managerOriginSchema, supportsMicrosoftSignIn } from "./manager-client";
import { createMissingProjectRecovery } from "./missing-project-recovery";
import { type CloudReturn, createNativeCloudReturn } from "./native-cloud-return";
import { createNativeCloudState } from "./native-cloud-state";
import { createNativeDeviceReader, finalizeDeviceLogin, readDeviceLogin } from "./native-device-read";
import { createNativeLoginRequests } from "./native-login-requests";
import { createNativeLogout } from "./native-logout";
import { createNativeManagerCall } from "./native-manager-call";
import { createNativePresence } from "./native-presence";
import {
  connectionSyncStatus,
  createFolderRecoveryReader,
  createNativeProjectSyncReader,
} from "./native-project-sync-read";
import { createNativeStore, type DeviceLogin } from "./native-store";
import { createNativeTeamMembership } from "./native-team-membership";
import { createNativeTeams } from "./native-teams";
import { createProjectCloudCatalog } from "./project-cloud-catalog";
import { createProjectCopyStore } from "./project-copy-store";
import { canPublishProjectExtensions } from "./project-publication-access";
import { initialProjectSyncStatus, recoveringProjectSyncStatus } from "./project-sync-readiness";
import { createTeamSyncAdmission } from "./team-sync-admission";

type FolderRecoveryOwners = (projectId: string) => ReturnType<typeof startFolderRecovery> | undefined;

const RETRY_MS = 60_000;
// Messages that are safe to show; other account failures stay generic.
export class AccountRequestError extends Error {}
export const accountUnavailableMessage = "Account request unavailable. Check the login and the account service.";

type SendDeviceCommand = (
  projectId: string,
  deviceId: string,
  command: DeviceCommand,
  signal: AbortSignal,
) => Promise<Json>;
const createDeviceCommandSender = () => {
  let send: SendDeviceCommand = async () => {
    throw new AccountRequestError("This project is not connected to Cloud");
  };
  return {
    send: (...args: Parameters<SendDeviceCommand>) => send(...args),
    connect: (next: SendDeviceCommand) => {
      send = next;
    },
  };
};

const devicePath = (id: string) => `/v1/devices/${encodeURIComponent(identitySchema.parse(id))}`;

const retryProjectSync = async (
  projectId: string,
  projects: Pick<RouteDeps["projectService"], "get">,
  refresh: () => Promise<void>,
  retry: ProjectSyncRetry,
  sourceId?: string,
) => {
  if (!(await projects.get(projectId))) throw new AccountRequestError("Unknown project");
  await refresh();
  await retry(projectId, sourceId);
  return { ok: true };
};

const retryFailedProjectSync = async (
  projectId: string,
  retry: ProjectSyncRetry,
  requireCurrent?: () => Promise<void>,
) => {
  const scheduled = await retry(projectId, { failedOnly: true }, requireCurrent);
  await scheduled?.settled;
};

const readManagerOrigin = (managerOrigin?: string) => {
  const parsed = managerOriginSchema.safeParse(
    managerOrigin ?? process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN ?? "https://base.prompt.studio/accounts",
  );
  if (!parsed.success)
    throw new AccountRequestError(
      "Use the https address of an account service, such as https://accounts.example.test.",
    );
  return parsed.data;
};

const readNativeStatus = async (input: {
  environment: RouteDeps["environmentService"];
  readLogin: (deviceId?: string) => Promise<DeviceLogin | null>;
  logins: Pick<ReturnType<typeof createNativeLoginRequests>, "attempt">;
  store: ReturnType<typeof createNativeStore>;
  cloud: ReturnType<typeof createNativeCloudState>;
  catalog: Pick<ReturnType<typeof createProjectCloudCatalog>, "knownProjectIds">;
  copies: ReturnType<typeof createProjectCopyStore>;
}) => {
  const { environment, readLogin, logins, store, cloud, catalog } = input;
  const { environmentId } = await environment.get();
  const login = await readLogin(environmentId);
  const status = await readAccountStatus(
    store,
    login,
    cloud.personal(),
    environmentId,
    catalog.knownProjectIds,
    cloud.online(),
  );
  const loginAttempt = logins.attempt();
  const bindings = await input.copies.teamProjects();
  const result: AccountStatus = {
    ...status,
    ...cloud.teamStatus(login),
    ...(bindings.length > 0 && {
      teamProjectOwners: Object.fromEntries(bindings.map(({ projectId, accountId }) => [projectId, accountId])),
    }),
    ...(loginAttempt && { loginAttempt }),
  };
  return result;
};

export const createNativeAccount = (input: {
  file: string;
  environment: RouteDeps["environmentService"];
  projects: Pick<RouteDeps["projectService"], "get">;
}) => {
  const store = createNativeStore(input.file);
  const copies = createProjectCopyStore(input.file);
  const presence = createNativePresence({
    denied: async (login) => {
      await store.reject(login.token, login);
      await refresh();
    },
  });
  const changes = createAccountWatch();
  const logins = createNativeLoginRequests(
    (...args) => finalizeDeviceLogin({ store, environment: input.environment, refresh }, ...args),
    changes.notify,
    async (origin) => {
      if (!(await supportsMicrosoftSignIn(origin)))
        throw new AccountRequestError("This Cloud service has not enabled Microsoft sign-in.");
    },
  );
  const cloud = createNativeCloudState();
  const { projectsFor } = cloud;
  let update: (connections: RelayWorkbench[]) => Promise<void> = async () => {};
  let retryProject: ProjectSyncRetry = async () => {};
  let folders: FolderRecoveryOwners = () => undefined;
  const away = createNativeCloudReturn();
  const admitTeams = createTeamSyncAdmission(copies, away);
  const commands = createDeviceCommandSender();
  const missing = createMissingProjectRecovery({
    exists: async (id) => Boolean(await input.projects.get(id)),
    recovered: () => {
      if (!closed) void refreshes.changed();
    },
  });
  // Until the relay runtime starts, no sync owner has downloaded anything in this run.
  let projectStatus: (projectId: string) => Promise<ProjectSyncStatus> = initialProjectSyncStatus;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const shutdown = new AbortController();

  // A login saved by another database in the same folder belongs to another device.
  const readLogin = (deviceId?: string) => readDeviceLogin(store, input.environment, deviceId);
  const current = async () => {
    const login = await readLogin();
    if (!login) throw new AccountRequestError("Log in first with pst login");
    return login;
  };
  const call = createNativeManagerCall({
    current,
    shutdown: shutdown.signal,
    reject: store.reject,
    refresh: () => refresh(),
    changed: () => new AccountRequestError("The account changed before the device read completed"),
    removed: () => new AccountRequestError("This device was removed from your account. Log in again with pst login"),
  });

  const readProjectStatus = (id: string, login: DeviceLogin | null) =>
    connectionSyncStatus(id, login, projectsFor, projectStatus, missing);
  const teams = createNativeTeams({
    current,
    call,
    copies,
    refresh: () => refresh(),
    personalProjects: (login) => catalog.knownProjectIds(login),
    project: input.projects.get,
  });
  const catalog = createProjectCloudCatalog({
    accountFile: input.file,
    projectLogin: teams.owner,
    login: readLogin,
    cloud: cloud.snapshot,
    projects: input.projects,
    online: cloud.online,
    syncStatus: async (id) => {
      const status = await projectStatus(id);
      return missing.recovering(id) ? recoveringProjectSyncStatus(status) : status;
    },
    returnedUploadState: away.removalState,
    call,
    refresh: () => refresh(),
    retry: (id, requireCurrent) => retryFailedProjectSync(id, retryProject, requireCurrent),
    withdraw: (id) => missing.withdraw(id).then(() => refreshes.changed()),
    changed: changes.notify,
  });

  // Syncs every cloud project of the account that exists here, then recovers the missing ones.
  // One that cannot be recovered yet is tried again on the next refresh.
  const publish = async (login: DeviceLogin | null, recoverMissing = true) => {
    void presence.update(login);
    const { local, absent } = await cloud.connections({
      login,
      catalog,
      accept: teams.acceptDiscovery,
      exists: input.projects.get,
      recovering: missing.recovering,
    });
    await admitTeams(login, local, projectsFor(login), update);
    if (recoverMissing) missing.recover(absent);
    await away.settle(login, projectsFor);
  };
  const load = async () => {
    clearTimeout(retry);
    if (closed) return;
    const login = await readLogin();
    await cloud.load({
      login,
      current: readLogin,
      reject: (device) => store.reject(device.token, device),
      catalog,
      teams,
      signal: shutdown.signal,
    });
    // Another device can enable or disable a project while this host is idle.
    // Refresh successful lists too; local database events cannot announce remote membership changes.
    if (login && !closed) {
      retry = setTimeout(() => void refresh(), RETRY_MS);
      retry.unref?.();
    }
    await publish(await readLogin());
    if (!closed) changes.notify();
  };
  const refreshes = createAccountRefresh({
    load,
    publish: async () => {
      if (closed) return;
      // Setup notifications update owners without turning a failed attempt into an immediate retry.
      await publish(await readLogin(), false);
      if (!closed) changes.notify();
    },
    failed: (error) => {
      apiLogger.warn({ event: "account.refresh.failed", error }, "Cloud project sync update failed");
    },
  });
  const refresh = refreshes.refresh;
  const membership = createNativeTeamMembership({ current, call, refresh, localProjectNames: teams.localProjectNames });
  const logout = createNativeLogout({ logins, readLogin, store, refresh });

  return {
    ...catalog,
    listTeams: teams.list,
    createTeam: teams.create,
    readTeamMembership: membership.read,
    writeTeamMembership: membership.write,
    prepareTeamProject: teams.prepareProject,
    canPublishProjectExtensions: canPublishProjectExtensions({ copies, readLogin, call }),
    ...createDeviceIdentity({ current, store, call }),
    sendDeviceCommand: commands.send,
    start(
      relay: (connections: RelayWorkbench[]) => Promise<void>,
      status: typeof projectStatus,
      recoverProject: Parameters<typeof missing.start>[0],
      retrySync: typeof retryProject = async () => {},
      sendCommand?: SendDeviceCommand,
      folderRecovery?: FolderRecoveryOwners,
      cloudReturn?: CloudReturn,
    ) {
      update = relay;
      away.connect(cloudReturn);
      if (folderRecovery) folders = folderRecovery;
      retryProject = retrySync;
      if (sendCommand) commands.connect(sendCommand);
      projectStatus = status;
      missing.start(recoverProject);
      void refresh();
    },
    refresh,
    watch: changes.watch,
    login: async (managerOrigin?: string, provider?: AccountSignInProvider) =>
      logins.start(readManagerOrigin(managerOrigin), provider),
    loginStatus: (id: string) => ({ status: logins.status(id), ...logins.failure(id) }),
    cancelLogin: logins.cancel,
    status: () =>
      readNativeStatus({ environment: input.environment, readLogin, logins, store, cloud, catalog, copies }),
    projectSyncStatus: createNativeProjectSyncReader({
      login: readLogin,
      exists: (id) => input.projects.get(id),
      read: (id, login) => catalog.fenceLocalStatus(id, login, () => readProjectStatus(id, login)),
      away: (id) => away.status(id),
      changed: () => new AccountRequestError("The account changed before the project sync read completed"),
      unknown: () => new AccountRequestError("Unknown project"),
    }),
    resolveReturnedChanges: (id: string, action: ProjectReturnAction) =>
      away.resolve(id, action, input.projects, refresh),
    retryProjectSync: (projectId: string, sourceId?: string) =>
      retryProjectSync(projectId, input.projects, refresh, retryProject, sourceId),
    /** The project's folder capture, download and restore owner on this device. */
    folderRecovery: createFolderRecoveryReader({
      exists: input.projects.get,
      login: readLogin,
      projectsFor,
      folder: (id) => folders(id),
    }),
    logout,
    devices: createNativeDeviceReader({
      current,
      call,
      changed: () => new AccountRequestError("The account changed before the device read completed"),
    }),
    renameDevice: (id: string, name: string) => call(`${devicePath(id)}/rename`, { name }).then(() => ({ ok: true })),
    async removeDevice(id: string) {
      const login = await current();
      if (id === login.deviceId) return logout();
      await call(`${devicePath(id)}/remove`, {});
      return { ok: true };
    },
    async syncProject(projectId: string) {
      if (!(await input.projects.get(projectId))) throw new AccountRequestError("Unknown project");
      return teams.changeMembership(projectId);
    },
    stopProjectSync: (projectId: string) => teams.changeMembership(projectId, true),
    async close() {
      closed = true;
      shutdown.abort();
      presence.close();
      clearTimeout(retry);
      update = async () => {};
      changes.close();
      // Startup account reads can still use the database; its owner closes only after they drain.
      await Promise.all([logins.close(), refreshes.done(), missing.close(), catalog.closeLocalRemovals()]);
    },
  };
};

export const nativeAccountFile = (databasePath: string, storageRoot: string, file?: string) =>
  file ?? join(databasePath === ":memory:" ? storageRoot : dirname(databasePath), "native-account.json");
