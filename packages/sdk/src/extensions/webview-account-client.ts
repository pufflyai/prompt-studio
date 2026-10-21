import type { ExtensionAccountApi } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";

/**
 * Same methods as `ctx.account`. Reads need the `account.read` capability and changes need
 * `account.manage`. Methods without a project id use the webview's project.
 */
export type WebviewAccountClient = ExtensionAccountApi;

export const createWebviewAccountClient = (host: GuestHost) =>
  ({
    status: () => host.call("account.read", { op: "status" }),
    loginStatus: (id) => host.call("account.read", { op: "loginStatus", id }),
    devices: () => host.call("account.read", { op: "devices" }),
    projectSyncStatus: (projectId) =>
      host.call("account.read", { op: "projectSyncStatus", ...(projectId ? { projectId } : {}) }),
    login: (managerOrigin) => host.call("account.manage", { op: "login", managerOrigin }),
    cancelLogin: (id) => host.call("account.manage", { op: "cancelLogin", id }),
    logout: () => host.call("account.manage", { op: "logout" }),
    renameDevice: (id, name) => host.call("account.manage", { op: "renameDevice", id, name }),
    removeDevice: (id) => host.call("account.manage", { op: "removeDevice", id }),
    syncProject: (projectId) => host.call("account.manage", { op: "syncProject", ...(projectId ? { projectId } : {}) }),
    stopProjectSync: (projectId) =>
      host.call("account.manage", { op: "stopProjectSync", ...(projectId ? { projectId } : {}) }),
  }) satisfies WebviewAccountClient;
