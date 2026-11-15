import type { ExtensionAccountApi, ProjectReturnAction } from "./account";
import type { WebviewAccountQuery, WebviewServiceQueryRequest } from "./webview-service-query";

export type WebviewAccountReadParams =
  | { op: "query"; query: WebviewServiceQueryRequest<WebviewAccountQuery> }
  | { op: "status" }
  | { op: "loginStatus"; id: string }
  | { op: "devices" }
  | { op: "projectSyncStatus"; projectId?: string };

/** Changes mirror `ctx.account`. A missing project id means the webview's project. */
export type WebviewAccountManageParams =
  | { op: "login"; managerOrigin?: string }
  | { op: "cancelLogin"; id: string }
  | { op: "logout" }
  | { op: "renameDevice"; id: string; name: string }
  | { op: "removeDevice"; id: string }
  | { op: "syncProject"; projectId?: string }
  | { op: "retryProjectSyncSource"; sourceId: string; projectId?: string }
  | { op: "stopProjectSync"; projectId?: string }
  | { op: "resolveReturnedChanges"; action: ProjectReturnAction; projectId?: string };

export type WebviewAccountResult<Params extends { op: keyof ExtensionAccountApi }> = Awaited<
  ReturnType<ExtensionAccountApi[Params["op"]]>
>;
