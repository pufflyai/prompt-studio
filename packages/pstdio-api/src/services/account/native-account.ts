import { hostname } from "node:os";
import { dirname, join } from "node:path";
import type { DeviceCommand, ProjectReturnAction, ProjectSyncStatus } from "pstdio-api-contracts";
import type { Json } from "pstdio-sync-contracts";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { RouteDeps } from "../../features/deps";
import { apiLogger } from "../../lib/logger";
import type { startFolderRecovery } from "../relay/folder-recovery";
import type { RelayWorkbench } from "../relay/runtime";

import { createAccountRefresh } from "./account-refresh";
import { readAccountStatus } from "./account-status";
import { createDeviceIdentity } from "./device-identity";
import { readManagerAccount } from "./manager-account";
import { ManagerRequestDenied, managerOriginSchema, managerRequest } from "./manager-client";
import { createMissingProjectRecovery } from "./missing-project-recovery";
import { type CloudReturn, createNativeCloudReturn } from "./native-cloud-return";
import { createNativeLoginRequests } from "./native-login-requests";
import { createNativePresence } from "./native-presence";
import { createNativeStore, type DeviceLogin } from "./native-store";
import { initialProjectSyncStatus, recoveringProjectSyncStatus } from "./project-sync-readiness";

type FolderRecoveryOwners = (projectId: string) => ReturnType<typeof startFolderRecovery> | undefined;

const RETRY_MS = 60_000;
const loginSchema = z.object({
  accountId: identitySchema,
  deviceId: identitySchema,
  token: z.string().min(1),
  relayOrigin: z.string(),
});
const devicesSchema = z.object({
  deviceId: identitySchema,
  devices: z.array(
    z.object({
      id: identitySchema,
      name: z.string(),
      platform: z.string(),
      createdAt: z.string(),
      lastSeenAt: z.string(),
      online: z.boolean(),
    }),
  ),
});

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

const readDeviceLogin = async (
  store: ReturnType<typeof createNativeStore>,
  environment: Pick<RouteDeps["environmentService"], "get">,
  deviceId?: string,
) => {
  const login = await store.read();
  const environmentId = deviceId ?? (await environment.get()).environmentId;
  return login?.deviceId === environmentId ? login : null;
};

const publicDevices = (payload: unknown) => {
  const listed = devicesSchema.parse(payload);
  return listed.devices.map((device) => ({ ...device, current: device.id === listed.deviceId }));
};

const denied = (error: unknown) => error instanceof ManagerRequestDenied && error.status === 401;
const devicePath = (id: string) => `/v1/devices/${encodeURIComponent(identitySchema.parse(id))}`;
const projectPath = (id: string) => `/v1/workbenches/${encodeURIComponent(identitySchema.parse(id))}`;

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

const connectionSyncStatus = async (
  projectId: string,
  login: DeviceLogin | null,
  projectsFor: (login: DeviceLogin | null) => string[] | undefined,
  projectStatus: (projectId: string) => Promise<ProjectSyncStatus>,
  missing: { recovering(projectId: string): boolean },
): Promise<ProjectSyncStatus> => {
  const projects = projectsFor(login);
  if (login && !projects) return { state: "offline", offlineReady: false };
  if (!projects?.includes(projectId)) return { state: "local", offlineReady: false };
  const status = await projectStatus(projectId);
  return missing.recovering(projectId) ? recoveringProjectSyncStatus(status) : status;
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
  const logins = createNativeLoginRequests((...args) => finishLogin(...args), changes.notify);
  let cloudProjects: { credential: string; ids: string[]; features: { relay: boolean } } | undefined;
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
  const call = async (path: string, body?: unknown, credential?: string, signal?: AbortSignal) => {
    const login = await current();
    if (credential && login.token !== credential) throw new Error("Device login changed");
    try {
      const cancellation = AbortSignal.any([shutdown.signal, ...(signal ? [signal] : [])]);
      return await managerRequest(login.managerOrigin, path, login.token, body, cancellation);
    } catch (error) {
      if (!denied(error)) throw error;
      // Removing this command owner drains its calls, so finish this rejected call before the refresh waits for it.
      await store.reject(login.token);
      void refresh();
      throw new AccountRequestError("This device was removed from your account. Log in again with pst login");
    }
  };

  // Syncs every cloud project of the account that exists here, then recovers the missing ones.
  // One that cannot be recovered yet is tried again on the next refresh.
  const publish = async (login: DeviceLogin | null, recoverMissing = true) => {
    void presence.update(login);
    const local: string[] = [];
    const absent: string[] = [];
    for (const id of login ? (projectsFor(login) ?? []) : []) {
      const exists = await input.projects.get(id);
      // Download durable data while extensions prepare; readiness remains fenced below.
      if (exists) local.push(id);
      // Keep the in-flight recovery in its account batch so refresh cannot cancel setup.
      if (!exists || missing.recovering(id)) absent.push(id);
    }
    await update(login ? local.map((id) => connectionFor(login, id)) : []);
    if (recoverMissing) missing.recover(login ? absent.map((id) => connectionFor(login, id)) : []);
    await away.settle(login, projectsFor);
  };
  const load = async () => {
    clearTimeout(retry);
    if (closed) return;
    let login = await readLogin();
    try {
      cloudProjects = login ? await readManagerAccount(login, shutdown.signal) : undefined;
    } catch (error) {
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
  const finishLogin = async (origin: string, session: string, signal: AbortSignal, user: { email: string }) => {
    const { environmentId } = await input.environment.get();
    const device = { deviceId: environmentId, name: hostname(), platform: process.platform };
    const login = loginSchema.parse(await managerRequest(origin, "/v1/device-login", session, device, signal));
    // The Google session is only needed to log in; the device credential replaces it.
    await managerRequest(origin, "/api/auth/sign-out", session, {}, signal).catch(() => {});
    signal.throwIfAborted();
    await store.save({ managerOrigin: origin, ...login, email: user.email });
    if (signal.aborted) {
      await store.forget(login.token);
      signal.throwIfAborted();
    }
    // Cloud discovery can wait for the network. Credential persistence completes
    // sign-in, so a later cancellation must not turn a successful login into failure.
    void refresh();
  };

  return {
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
    async login(managerOrigin?: string) {
      const parsed = managerOriginSchema.safeParse(
        managerOrigin ?? process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN ?? "https://base.prompt.studio/accounts",
      );
      if (!parsed.success)
        throw new AccountRequestError(
          "Use the https address of an account service, such as https://accounts.example.test.",
        );
      const origin = parsed.data;
      return logins.start(origin);
    },
    loginStatus: (id: string) => ({ status: logins.status(id) }),
    cancelLogin: logins.cancel,
    async status() {
      const { environmentId } = await input.environment.get();
      const account = await readAccountStatus(store, await readLogin(environmentId), cloudProjects, environmentId);
      const loginAttempt = logins.attempt();
      return { ...account, ...(loginAttempt ? { loginAttempt } : {}) };
    },
    async projectSyncStatus(projectId: string): Promise<ProjectSyncStatus> {
      if (!(await input.projects.get(projectId))) throw new AccountRequestError("Unknown project");
      const status = await connectionSyncStatus(projectId, await readLogin(), projectsFor, projectStatus, missing);
      return { ...status, ...(await away.status(projectId)) };
    },
    retryProjectSync: (projectId: string, sourceId?: string) =>
      retryProjectSync(projectId, input.projects, refresh, retryProject, sourceId),
    resolveReturnedChanges: (id: string, action: ProjectReturnAction) =>
      away.resolve(id, action, input.projects, refresh),
    /** The project's folder capture, download and restore owner on this device. */
    async folderRecovery(projectId: string) {
      if (!(await input.projects.get(projectId))) throw new AccountRequestError("Unknown project");
      const login = await readLogin();
      if (!login) throw new AccountRequestError("Log in first with pst login");
      if (!projectsFor(login)?.includes(projectId))
        throw new AccountRequestError("This project does not sync with Cloud on this device");
      const owner = folders(projectId);
      if (!owner) throw new AccountRequestError("Cloud sync for this project is starting. Try again shortly.");
      return owner;
    },
    logout,
    devices: async () => publicDevices(await call("/v1/devices")),
    renameDevice: (id: string, name: string) => call(`${devicePath(id)}/rename`, { name }).then(() => ({ ok: true })),
    async removeDevice(id: string) {
      const login = await current();
      if (id === login.deviceId) return logout();
      await call(`${devicePath(id)}/remove`, {});
      return { ok: true };
    },
    async syncProject(projectId: string) {
      if (!(await input.projects.get(projectId))) throw new AccountRequestError("Unknown project");
      await call(projectPath(projectId), {});
      await refresh();
      return { ok: true };
    },
    async stopProjectSync(projectId: string) {
      await call(`${projectPath(projectId)}/remove`, {});
      await refresh();
      return { ok: true };
    },
    async close() {
      closed = true;
      shutdown.abort();
      presence.close();
      clearTimeout(retry);
      update = async () => {};
      changes.close();
      // Startup account reads can still use the database; its owner closes only after they drain.
      await Promise.all([logins.close(), refreshes.done(), missing.close()]);
    },
  };
};

export const nativeAccountFile = (databasePath: string, storageRoot: string, file?: string) =>
  file ?? join(databasePath === ":memory:" ? storageRoot : dirname(databasePath), "native-account.json");
