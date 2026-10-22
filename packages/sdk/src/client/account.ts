import type {
  AccountDevice,
  AccountLogin,
  AccountLoginStatus,
  AccountStatus,
  ProjectSyncStatus,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type { AccountDevice, AccountStatus, DeviceLogin } from "pstdio-api-contracts";

type Ok = { ok: boolean };

export const createAccountClient = (request: RequestFn) => {
  const device = (id: string) => `/v1/account/devices/${encodeURIComponent(id)}`;
  const project = (id: string) => `/v1/account/projects/${encodeURIComponent(id)}`;
  const login = (id: string) => `/v1/account/login/${encodeURIComponent(id)}`;
  return {
    login: (managerOrigin: string) =>
      request<AccountLogin>("/v1/account/login", { method: "POST", body: { managerOrigin } }),
    loginStatus: (id: string) => request<{ status: AccountLoginStatus }>(login(id)),
    /** Cancels a pending sign-in. A sign-in that already completed stays complete. */
    cancelLogin: (id: string) =>
      request<Ok & { status: Exclude<AccountLoginStatus, "pending"> }>(login(id), { method: "DELETE" }),
    projectSyncStatus: (projectId: string) => request<ProjectSyncStatus>(`${project(projectId)}/sync`),
    status: () => request<AccountStatus>("/v1/account"),
    /** `removed` is false when the account service could not be reached; remove the device from another one. */
    logout: () => request<Ok & { removed: boolean }>("/v1/account/logout", { method: "POST" }),
    devices: () => request<AccountDevice[]>("/v1/account/devices"),
    renameDevice: (id: string, name: string) => request<Ok>(`${device(id)}/rename`, { method: "POST", body: { name } }),
    removeDevice: (id: string) => request<Ok>(`${device(id)}/remove`, { method: "POST" }),
    /** Makes a local project a cloud project of the logged-in account. */
    syncProject: (projectId: string) => request<Ok>(project(projectId), { method: "PUT" }),
    /** Stops syncing a cloud project. Every device keeps its local copy. */
    stopProjectSync: (projectId: string) => request<Ok>(project(projectId), { method: "DELETE" }),
  };
};
export type AccountClient = ReturnType<typeof createAccountClient>;
