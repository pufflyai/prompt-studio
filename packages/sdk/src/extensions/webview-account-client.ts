import type {
  ExtensionAccountApi,
  WebviewAccountQuery,
  WebviewAccountQueryValue,
} from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { getWebviewServiceQueries, type WebviewServiceQuery } from "./webview-service-query";

/**
 * Same methods as `ctx.account`. Reads need the `account.read` capability and changes need
 * `account.manage`. Methods without a project id use the webview's project.
 */
export interface WebviewAccountClient extends ExtensionAccountApi {
  query<Definition extends WebviewAccountQuery>(
    source: Definition,
  ): WebviewServiceQuery<WebviewAccountQueryValue<Definition>>;
}

export const createWebviewAccountClient = (host: GuestHost) =>
  ({
    query: (source) => getWebviewServiceQueries(host, "account").query(source),
    status: () => host.call("account.read", { op: "status" }),
    loginStatus: (id) => host.call("account.read", { op: "loginStatus", id }),
    devices: () => host.call("account.read", { op: "devices" }),
    projectSyncStatus: (projectId) =>
      host.call("account.read", { op: "projectSyncStatus", ...(projectId ? { projectId } : {}) }),
    retryProjectSyncSource: (sourceId, projectId) =>
      host.call("account.manage", { op: "retryProjectSyncSource", sourceId, ...(projectId ? { projectId } : {}) }),
    login: (managerOrigin) => host.call("account.manage", { op: "login", managerOrigin }),
    cancelLogin: (id) => host.call("account.manage", { op: "cancelLogin", id }),
    logout: () => host.call("account.manage", { op: "logout" }),
    renameDevice: (id, name) => host.call("account.manage", { op: "renameDevice", id, name }),
    removeDevice: (id) => host.call("account.manage", { op: "removeDevice", id }),
    syncProject: (projectId) => host.call("account.manage", { op: "syncProject", ...(projectId ? { projectId } : {}) }),
    stopProjectSync: (projectId) =>
      host.call("account.manage", { op: "stopProjectSync", ...(projectId ? { projectId } : {}) }),
    resolveReturnedChanges: (action, projectId) =>
      host.call("account.manage", { op: "resolveReturnedChanges", action, ...(projectId ? { projectId } : {}) }),
  }) satisfies WebviewAccountClient;
