import type {
  AccountSignInProvider,
  ExtensionAccountApi,
  ProjectReturnAction,
  TeamMembershipRead,
  TeamMembershipReadResult,
  TeamMembershipWrite,
  TeamMembershipWriteResult,
} from "./account";
import type { WebviewAccountQuery, WebviewServiceQueryRequest } from "./webview-service-query";

export type WebviewAccountReadParams =
  | { op: "query"; query: WebviewServiceQueryRequest<WebviewAccountQuery> }
  | { op: "status" }
  | { op: "loginStatus"; id: string }
  | {
      op: "readTeamMembership";
      request: TeamMembershipRead;
      expected?: Parameters<ExtensionAccountApi["readTeamMembership"]>[1];
    }
  | { op: "devices" }
  | { op: "projectSyncStatus"; projectId?: string };

/** Changes mirror `ctx.account`. A missing project id means the webview's project. */
export type WebviewAccountManageParams =
  | { op: "login"; managerOrigin?: string; provider?: AccountSignInProvider }
  | { op: "cancelLogin"; id: string }
  | { op: "logout" }
  | { op: "createTeam"; name: string; expected?: Parameters<ExtensionAccountApi["createTeam"]>[1] }
  | {
      op: "writeTeamMembership";
      request: TeamMembershipWrite;
      expected?: Parameters<ExtensionAccountApi["writeTeamMembership"]>[1];
    }
  | { op: "renameDevice"; id: string; name: string }
  | { op: "removeDevice"; id: string }
  | { op: "syncProject"; projectId?: string }
  | { op: "retryProjectSyncSource"; sourceId: string; projectId?: string }
  | { op: "stopProjectSync"; projectId?: string }
  | { op: "resolveReturnedChanges"; action: ProjectReturnAction; projectId?: string };

export type WebviewAccountResult<Params extends { op: keyof ExtensionAccountApi }> = Params extends {
  op: "readTeamMembership";
  request: infer Request extends TeamMembershipRead;
}
  ? TeamMembershipReadResult<Request>
  : Params extends { op: "writeTeamMembership"; request: infer Request extends TeamMembershipWrite }
    ? TeamMembershipWriteResult<Request>
    : Awaited<ReturnType<ExtensionAccountApi[Params["op"]]>>;
