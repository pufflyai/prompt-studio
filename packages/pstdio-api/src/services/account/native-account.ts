import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { RouteDeps } from "../../features/deps";
import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "../relay/runtime";
import { ManagerRequestDenied, managerOriginSchema, managerRequest } from "./manager-client";
import { startNativeLogin } from "./native-login";
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
    }),
  ),
});
const workbenchesSchema = z.array(z.object({ workbenchId: identitySchema }));

// Messages that are safe to show; other account failures stay generic.
export class AccountRequestError extends Error {}

export const createNativeAccount = (input: {
  file: string;
  environment: RouteDeps["environmentService"];
  projects: Pick<RouteDeps["projectService"], "get">;
}) => {
  const store = createNativeStore(input.file);
  const logins = new Map<string, ReturnType<typeof startNativeLogin>>();
  let cloudProjects: string[] = [];
  let update: (connections: RelayWorkbench[]) => Promise<void> = async () => {};
  let retry: ReturnType<typeof setTimeout> | undefined;
  let refreshing = Promise.resolve();

  const current = async () => {
    const login = await store.read();
    if (!login) throw new AccountRequestError("Log in first with pst login");
    return login;
  };
  const call = async (path: string, body?: unknown) => {
    const login = await current();
    return managerRequest(login.managerOrigin, path, login.token, body);
  };
  const devicePath = (id: string) => `/v1/devices/${encodeURIComponent(identitySchema.parse(id))}`;
  const projectPath = (id: string) => `/v1/workbenches/${encodeURIComponent(identitySchema.parse(id))}`;

  // Syncs every cloud project that also exists on this device. Others start once they are created or bound here.
  const publish = async (login: DeviceLogin | null) => {
    const local = await Promise.all(cloudProjects.map(async (id) => ((await input.projects.get(id)) ? id : null)));
    await update(
      login
        ? local
            .filter((id) => id !== null)
            .map((workbenchId) => ({
              accountId: login.accountId,
              workbenchId,
              environmentId: login.deviceId,
              relayOrigin: login.relayOrigin,
              managerOrigin: login.managerOrigin,
              renewalGrant: login.token,
            }))
        : [],
    );
  };
  const load = async () => {
    clearTimeout(retry);
    let login = await store.read();
    try {
      cloudProjects = login
        ? workbenchesSchema
            .parse(await managerRequest(login.managerOrigin, "/v1/workbenches", login.token))
            .map((row) => row.workbenchId)
        : [];
    } catch (error) {
      if (error instanceof ManagerRequestDenied && error.status === 401) {
        // Another device removed this one, so its credential no longer works.
        await store.save(null);
        login = null;
        cloudProjects = [];
      } else {
        // Local work continues offline. The list loads once the account service is reachable.
        apiLogger.warn({ event: "account.cloud_projects.unavailable" }, "Cloud projects will load later");
        retry = setTimeout(() => void refresh(), RETRY_MS);
        retry.unref?.();
      }
    }
    await publish(login);
  };
  const refresh = () => {
    refreshing = refreshing.then(load).catch((error: unknown) => {
      apiLogger.warn({ event: "account.refresh.failed", error }, "Cloud project sync update failed");
    });
    return refreshing;
  };
  const logout = async () => {
    const login = await current();
    await managerRequest(login.managerOrigin, `${devicePath(login.deviceId)}/remove`, login.token, {});
    await store.save(null);
    await refresh();
    return { ok: true };
  };
  const finishLogin = async (origin: string, session: string, signal: AbortSignal) => {
    const { environmentId } = await input.environment.get();
    const device = { deviceId: environmentId, name: hostname(), platform: process.platform };
    const login = loginSchema.parse(await managerRequest(origin, "/v1/device-login", session, device, signal));
    // The Google session is only needed to log in; the device credential replaces it.
    await managerRequest(origin, "/api/auth/sign-out", session, {}, signal).catch(() => {});
    signal.throwIfAborted();
    await store.save({ managerOrigin: origin, ...login });
    await refresh();
  };

  return {
    start(relay: (connections: RelayWorkbench[]) => Promise<void>) {
      update = relay;
      void refresh();
    },
    refresh,
    async login(managerOrigin: string) {
      const origin = managerOriginSchema.parse(managerOrigin);
      for (const [id, login] of logins)
        if (login.status() !== "pending") {
          login.close();
          logins.delete(id);
        }
      const id = crypto.randomUUID();
      const login = startNativeLogin(origin, (session, signal) => finishLogin(origin, session, signal));
      logins.set(id, login);
      return { id, url: login.url };
    },
    loginStatus: (id: string) => ({ status: logins.get(id)?.status() ?? "failed" }),
    async status() {
      const login = await store.read();
      if (!login) return { login: null, cloudProjects: [] };
      const { token: _, ...device } = login;
      return { login: device, cloudProjects };
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
    close() {
      clearTimeout(retry);
      update = async () => {};
      for (const login of logins.values()) login.close();
      logins.clear();
    },
  };
};

export const nativeAccountFile = (databasePath: string, storageRoot: string, file?: string) =>
  file ?? join(databasePath === ":memory:" ? storageRoot : dirname(databasePath), "native-account.json");
