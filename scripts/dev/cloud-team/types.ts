export interface Actor {
  workspaceId: string;
  runId: string;
  pod: string;
}
export interface Pair {
  id: string;
  directory: string;
  source: string;
  sourceCommit: string;
  sourceDirty: boolean;
  kubectl: string;
  namespace: string;
  name: string;
  deadline: string;
  owner?: Actor;
  member?: Actor;
  teamId?: string;
  projectId?: string;
  hiddenProjectId?: string;
  memberUserId?: string;
  required?: { extensionId: string; selectionId: string };
}
interface CommonConfig {
  managerOrigin: string;
  relayOrigin: string;
  cert: string;
  deadline: string;
}
export type WorkspaceConfig = CommonConfig &
  (
    | { role: "member" }
    | {
        role: "owner";
        databaseUrl: string;
        objectEndpoint: string;
        objectKey: string;
        objectSecret: string;
        controlToken: string;
        key: string;
      }
  );
export interface Extension {
  id: string;
  extensionId: string;
  enabled: boolean;
  status: string;
  choiceRestriction?: string;
}
