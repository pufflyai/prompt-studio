import type { RequestFn } from "./request";

/** This device's cloud login. The device credential stays in the native host. */
export interface DeviceLogin {
  managerOrigin: string;
  relayOrigin: string;
  accountId: string;
  deviceId: string;
}
export interface AccountStatus {
  login: DeviceLogin | null;
  /** Cloud projects of the account. This device syncs the ones that exist on it. */
  cloudProjects: string[];
}
export interface AccountDevice {
  id: string;
  name: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  /** True for the device that answered the request. */
  current: boolean;
}
type Ok = { ok: boolean };

export const createAccountClient = (request: RequestFn) => {
  const device = (id: string) => `/v1/account/devices/${encodeURIComponent(id)}`;
  const project = (id: string) => `/v1/account/projects/${encodeURIComponent(id)}`;
  return {
    login: (managerOrigin: string) =>
      request<{ id: string; url: string }>("/v1/account/login", { method: "POST", body: { managerOrigin } }),
    loginStatus: (id: string) =>
      request<{ status: "pending" | "complete" | "failed" }>(`/v1/account/login/${encodeURIComponent(id)}`),
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
