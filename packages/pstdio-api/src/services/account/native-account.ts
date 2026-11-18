import { dirname, join } from "node:path";
import type { DeviceCommand, ProjectReturnAction, ProjectSyncStatus } from "pstdio-api-contracts";
import type { Json } from "pstdio-sync-contracts";
import { identitySchema } from "pstdio-sync-contracts";
import type { RouteDeps } from "../../features/deps";
import { apiLogger } from "../../lib/logger";
import type { startFolderRecovery } from "../relay/folder-recovery";
import type { RelayWorkbench } from "../relay/runtime";
import { createAccountRefresh } from "./account-refresh";
import { readAccountStatus } from "./account-status";
import { createDeviceIdentity } from "./device-identity";
import { catalogStatus } from "./local-removal-preflight";
import type { readManagerAccount } from "./manager-account";
import { ManagerRequestDenied, managerOriginSchema, managerRequest } from "./manager-client";
import { createMissingProjectRecovery, partitionCloudProjects } from "./missing-project-recovery";
import { type CloudReturn, createNativeCloudReturn } from "./native-cloud-return";
import { createNativeDeviceReader, finalizeDeviceLogin, readDeviceLogin } from "./native-device-read";
import { createNativeLoginRequests } from "./native-login-requests";
import { createNativeManagerCall } from "./native-manager-call";
import { createNativePresence } from "./native-presence";
import {
  connectionSyncStatus,
  createFolderRecoveryReader,
  createNativeProjectSyncReader,
} from "./native-project-sync-read";
import { createNativeStore, type DeviceLogin } from "./native-store";
import { createProjectCloudCatalog } from "./project-cloud-catalog";
import { initialProjectSyncStatus } from "./project-sync-readiness";

type FolderRecoveryOwners = (projectId: string) => ReturnType<typeof startFolderRecovery> | undefined;

const RETRY_MS = 60_000;
const connectionFor = (login: DeviceLogin, workbenchId: string) => ({
  accountId: login.accountId,
  workbenchId,
  environmentId: login.deviceId,
  relayOrigin: login.relayOrigin,
  managerOrigin: login.managerOrigin,
  renewalGrant: login.token,
});

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

const createAccountWatch = () => {
  const listeners = new Set<() => void>();
  return {
    watch(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify() {
      for (const listener of listeners) listener();
    },
    close() {
      listeners.clear();
    },
  };
};

const denied = (error: unknown) => error instanceof ManagerRequestDenied && error.status === 401;
const devicePath = (id: string) => `/v1/devices/${encodeURIComponent(identitySchema.parse(id))}`;
const projectPath = (id: string) => `/v1/workbenches/${encodeURIComponent(identitySchema.parse(id))}`;

const changeCloudMembership =
  (call: ReturnType<typeof createNativeManagerCall>, refresh: () => Promise<void>) => async (path: string) => {
    await call(path, {});
    await refresh();
    return { ok: true };
  };

const retryProjectSync = async (
  projectId: string,
  projects: Pick<RouteDeps["projectService"], "get">,
  refresh: () => Promise<void>,
  retry: (projectId: string, sourceId?: string) => Promise<void>,
  sourceId?: string,
) => {
  if (!(await projects.get(projectId))) throw new AccountRequestError("Unknown project");
  await refresh();
  await retry(projectId, sourceId);
  return { ok: true };
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

export const createNativeAccount = (input: {
  file: string;
  environment: RouteDeps["environmentService"];
  projects: Pick<RouteDeps["projectService"], "get">;
}) => {
  const store = createNativeStore(input.file);
  const presence = createNativePresence({
    denied: async (credential) => {
      await store.reject(credential);
      await refresh();
    },
  });
  const changes = createAccountWatch();
  const logins = createNativeLoginRequests(
    (...args) => finalizeDeviceLogin({ store, environment: input.environment, refresh }, ...args),
    changes.notify,
  );
  let cloudProjects: Awaited<ReturnType<typeof readManagerAccount>> | undefined;
  let online = false;
  const projectsFor = (login: DeviceLogin | null) =>
    login?.token === cloudProjects?.credential ? cloudProjects?.ids : undefined;
  let update: (connections: RelayWorkbench[]) => Promise<void> = async () => {};
  let retryProject: (projectId: string, sourceId?: string) => Promise<void> = async () => {};
  let folders: FolderRecoveryOwners = () => undefined;
  const away = createNativeCloudReturn();
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

  const catalog = createProjectCloudCatalog({
    accountFile: input.file,
    login: readLogin,
    cloud: (login) => (cloudProjects?.credential === login.token ? cloudProjects : undefined),
    projects: input.projects,
    ...catalogStatus(
      () => online,
      (id) => projectStatus(id),
      away,
    ),
    call,
    refresh: () => refresh(),
    retry: (id) => retryProject(id),
    withdraw: (id) => missing.withdraw(id).then(() => refreshes.changed()),
    changed: changes.notify,
  });

  // Syncs every cloud project of the account that exists here, then recovers the missing ones.
  // One that cannot be recovered yet is tried again on the next refresh.
  const publish = async (login: DeviceLogin | null, recoverMissing = true) => {
    void presence.update(login);
    const withdrawn = login ? await catalog.withdrawnProjectIds(login) : new Set<string>();
    const { local, absent } = await partitionCloudProjects(
      login ? (projectsFor(login) ?? []) : [],
      withdrawn,
      input.projects.get,
      missing.recovering,
    );
    await update(login ? local.map((id) => connectionFor(login, id)) : []);
    if (recoverMissing) missing.recover(login ? absent.map((id) => connectionFor(login, id)) : []);
    await away.settle(login, projectsFor);
  };
  const load = async () => {
    clearTimeout(retry);
    if (closed) return;
    let login = await readLogin();
    try {
      cloudProjects = login ? await catalog.readCloud(login, shutdown.signal) : undefined;
      online = Boolean(cloudProjects);
    } catch (error) {
      online = false;
      if (login && denied(error)) {
        // Another device removed this one. A newer login saved meanwhile stays.
        await store.reject(login.token);
        login = await readLogin();
        cloudProjects = undefined;
      } else if (!closed) {
        // Local work continues offline. The list loads once the account service is reachable.
        apiLogger.warn({ event: "account.cloud_projects.unavailable" }, "Cloud projects will load later");
      }
    }
    // Another device can enable or disable a project while this host is idle.
    // Refresh successful lists too; local database events cannot announce remote membership changes.
    if (login && !closed) {
      retry = setTimeout(() => void refresh(), RETRY_MS);
      retry.unref?.();
    }
    await publish(login);
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
  const changeMembership = changeCloudMembership(call, refresh);
  // Logging out works offline and after removal. Removing the device at the manager is best effort.
  const logout = () =>
    logins.logout(async () => {
      const login = await readLogin();
      if (!login) {
        await store.forget(null);
        await refresh();
        return { ok: true, removed: false };
      }
      const removed = await managerRequest(login.managerOrigin, `${devicePath(login.deviceId)}/remove`, login.token, {})
        .then(() => true)
        .catch(() => false);
      await store.forget(login.token);
      await refresh();
      return { ok: true, removed };
    });

  return {
    ...catalog,
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
    login: (managerOrigin?: string) => logins.start(readManagerOrigin(managerOrigin)),
    loginStatus: (id: string) => ({ status: logins.status(id) }),
    cancelLogin: logins.cancel,
    async status() {
      const { environmentId } = await input.environment.get();
      const loginAttempt = logins.attempt();
      return {
        ...(await readAccountStatus(store, await readLogin(environmentId), cloudProjects, environmentId)),
        ...(loginAttempt ? { loginAttempt } : {}),
      };
    },
    projectSyncStatus: createNativeProjectSyncReader({
      login: readLogin,
      exists: (id) => input.projects.get(id),
      read: (id, login) => connectionSyncStatus(id, login, projectsFor, projectStatus, missing),
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
      return changeMembership(projectPath(projectId));
    },
    stopProjectSync: (projectId: string) => changeMembership(`${projectPath(projectId)}/remove`),
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
