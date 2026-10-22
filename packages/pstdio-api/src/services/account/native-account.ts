import { hostname } from "node:os";
import { dirname, join } from "node:path";
import type { ProjectSyncStatus } from "pstdio-api-contracts";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { RouteDeps } from "../../features/deps";
import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "../relay/runtime";
import { ManagerRequestDenied, managerOriginSchema, managerRequest } from "./manager-client";
import { createMissingProjectRecovery } from "./missing-project-recovery";
import { startNativeLogin } from "./native-login";
import { createNativePresence } from "./native-presence";
import { createNativeStore, type DeviceLogin } from "./native-store";

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
const workbenchesSchema = z.array(z.object({ workbenchId: identitySchema }));

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

export const createNativeAccount = (input: {
  file: string;
  environment: RouteDeps["environmentService"];
  projects: Pick<RouteDeps["projectService"], "get">;
}) => {
  const store = createNativeStore(input.file);
  const presence = createNativePresence({
    denied: async (credential) => {
      await store.forget(credential);
      await refresh();
    },
  });
  const logins = new Map<string, ReturnType<typeof startNativeLogin>>();
  let cloudProjects: { credential: string; ids: string[] } | undefined;
  const projectsFor = (login: DeviceLogin | null) =>
    login?.token === cloudProjects?.credential ? cloudProjects?.ids : undefined;
  let update: (connections: RelayWorkbench[]) => Promise<void> = async () => {};
  const missing = createMissingProjectRecovery({
    exists: async (id) => Boolean(await input.projects.get(id)),
    recovered: () => void refresh(),
  });
  // Until the relay runtime starts, no sync owner has downloaded anything in this run.
  let projectStatus = async (_projectId: string): Promise<ProjectSyncStatus> => ({
    state: "first-download-incomplete",
    offlineReady: false,
  });
  let retry: ReturnType<typeof setTimeout> | undefined;
  let refreshing = Promise.resolve();
  let queued: Promise<void> | undefined;
  let closed = false;

  // A login saved by another database in the same folder belongs to another device.
  const readLogin = async () => {
    const login = await store.read();
    const { environmentId } = await input.environment.get();
    return login?.deviceId === environmentId ? login : null;
  };
  const current = async () => {
    const login = await readLogin();
    if (!login) throw new AccountRequestError("Log in first with pst login");
    return login;
  };
  const denied = (error: unknown) => error instanceof ManagerRequestDenied && error.status === 401;
  const call = async (path: string, body?: unknown) => {
    const login = await current();
    try {
      return await managerRequest(login.managerOrigin, path, login.token, body);
    } catch (error) {
      if (!denied(error)) throw error;
      // Another device removed this one, so its credential no longer works.
      await store.forget(login.token);
      await refresh();
      throw new AccountRequestError("This device was removed from your account. Log in again with pst login");
    }
  };
  const devicePath = (id: string) => `/v1/devices/${encodeURIComponent(identitySchema.parse(id))}`;
  const projectPath = (id: string) => `/v1/workbenches/${encodeURIComponent(identitySchema.parse(id))}`;

  // Syncs every cloud project of the account that exists here, then recovers the missing ones.
  // One that cannot be recovered yet is tried again on the next refresh.
  const publish = async (login: DeviceLogin | null) => {
    void presence.update(login);
    const local: string[] = [];
    const absent: string[] = [];
    for (const id of login ? (projectsFor(login) ?? []) : [])
      ((await input.projects.get(id)) ? local : absent).push(id);
    await update(login ? local.map((id) => connectionFor(login, id)) : []);
    if (login && absent.length) missing.recover(absent.map((id) => connectionFor(login, id)));
  };
  const load = async () => {
    clearTimeout(retry);
    if (closed) return;
    let login = await readLogin();
    try {
      cloudProjects = login
        ? {
            credential: login.token,
            ids: workbenchesSchema
              .parse(await managerRequest(login.managerOrigin, "/v1/workbenches", login.token))
              .map((row) => row.workbenchId),
          }
        : undefined;
    } catch (error) {
      if (login && denied(error)) {
        // Another device removed this one. A newer login saved meanwhile stays.
        await store.forget(login.token);
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
  };
  // Refreshes run one at a time. Calls that arrive while one waits to start share it.
  const refresh = () => {
    if (queued) return queued;
    const next = refreshing
      .then(() => {
        queued = undefined;
        return load();
      })
      .catch((error: unknown) => {
        apiLogger.warn({ event: "account.refresh.failed", error }, "Cloud project sync update failed");
      });
    queued = next;
    refreshing = next;
    return next;
  };
  // Logging out works offline and after removal. Removing the device at the manager is best effort.
  const logout = async () => {
    const login = await current();
    const removed = await managerRequest(login.managerOrigin, `${devicePath(login.deviceId)}/remove`, login.token, {})
      .then(() => true)
      .catch(() => false);
    await store.forget(login.token);
    await refresh();
    return { ok: true, removed };
  };
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
    start(
      relay: (connections: RelayWorkbench[]) => Promise<void>,
      status: typeof projectStatus,
      recoverProject: Parameters<typeof missing.start>[0],
    ) {
      update = relay;
      projectStatus = status;
      missing.start(recoverProject);
      void refresh();
    },
    refresh,
    async login(managerOrigin: string) {
      const parsed = managerOriginSchema.safeParse(managerOrigin);
      if (!parsed.success)
        throw new AccountRequestError(
          "Use the https address of an account service, such as https://accounts.example.test.",
        );
      const origin = parsed.data;
      for (const [id, login] of logins)
        if (login.status() !== "pending") {
          login.close();
          logins.delete(id);
        }
      const id = crypto.randomUUID();
      const login = startNativeLogin(origin, (session, signal, user) => finishLogin(origin, session, signal, user));
      logins.set(id, login);
      return { id, url: login.url };
    },
    loginStatus: (id: string) => ({ status: logins.get(id)?.status() ?? "failed" }),
    async cancelLogin(id: string) {
      const login = logins.get(id);
      if (login?.status() === "complete") return { ok: false, status: "complete" as const };
      await login?.close();
      logins.delete(id);
      return { ok: true, status: "failed" as const };
    },
    async status() {
      const login = await readLogin();
      if (!login) return { login: null, cloudProjects: [] as string[], cloudProjectsLoaded: true };
      const { token: _, ...device } = login;
      const projects = projectsFor(login);
      return { login: device, cloudProjects: projects ?? [], cloudProjectsLoaded: !!projects };
    },
    async projectSyncStatus(projectId: string) {
      if (!(await input.projects.get(projectId))) throw new AccountRequestError("Unknown project");
      const login = await readLogin();
      const projects = projectsFor(login);
      if (login && !projects) return { state: "offline" as const, offlineReady: false };
      if (!projects?.includes(projectId)) return { state: "local" as const, offlineReady: false };
      return projectStatus(projectId);
    },
    logout,
    async devices() {
      const listed = devicesSchema.parse(await call("/v1/devices"));
      return listed.devices.map((device) => ({ ...device, current: device.id === listed.deviceId }));
    },
    async renameDevice(id: string, name: string) {
      await call(`${devicePath(id)}/rename`, { name });
      return { ok: true };
    },
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
      presence.close();
      clearTimeout(retry);
      update = async () => {};
      for (const login of logins.values()) login.close();
      logins.clear();
      await missing.close();
    },
  };
};

export const nativeAccountFile = (databasePath: string, storageRoot: string, file?: string) =>
  file ?? join(databasePath === ":memory:" ? storageRoot : dirname(databasePath), "native-account.json");
