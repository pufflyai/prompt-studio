import type { Notification } from "pstdio-api-contracts";
import type {
  ArtifactMount,
  CommandOutcome,
  ExtensionNotifyApi,
  ExtensionPackageFilesApi,
  ExtensionRecordsApi,
  ExtensionResourcesApi,
  ExtensionSessionQuery,
  ExtensionSessionsApi,
  ExtensionSettingsApi,
  ExtensionStorageApi,
  ExtensionViewsApi,
  ExtensionWorkspacesApi,
  JsonValue,
  StorageRecord,
} from "pstdio-api-contracts/extension-kernel";
import type { CommandStreamClientEvent } from "../../src/client/extension-stream";

export type AuthorStatus = "done" | "dismissed";
export type NotifyInput = { id?: string; dedupeKey?: string; status?: AuthorStatus | "expired" };
export type Selector = { by: "id"; id: string } | { by: "dedupeKey"; dedupeKey: string };
export type ReadFiles = ExtensionPackageFilesApi;
export type FileRoot =
  | { root: "package" }
  | { root: "local" }
  | { root: "shared"; mount: string }
  | { root: "workspace"; target: "current" | "default" };
export type Records = ExtensionRecordsApi;
export type SaveOptions = { operationId: string };
export type Session = Awaited<ReturnType<ExtensionSessionsApi["query"]>>["items"][number];
export type SessionFilter = Pick<ExtensionSessionQuery, "workspaceId" | "status">;
export type CommandStream = AsyncIterable<string> & {
  outcome: Promise<CommandOutcome<string>>;
  cancel(): Promise<void>;
};

export class CommandFailure extends Error {
  constructor(public outcome: Extract<CommandOutcome, { ok: false }>) {
    super(outcome.reason);
    this.name = "CommandFailure";
  }
}

export type CurrentApi = {
  notify: Pick<ExtensionNotifyApi, "resolve">;
  packageFiles: ReadFiles;
  extensionFiles?: ArtifactMount;
  workspaceFiles?: ArtifactMount;
  artifacts: { mount(id: string): ArtifactMount };
  storage: ExtensionStorageApi;
  sessions: Pick<ExtensionSessionsApi, "query" | "addAnchors">;
  resources: Pick<ExtensionResourcesApi, "addAnchors">;
  settings: Pick<ExtensionSettingsApi, "delete">;
  views: Pick<ExtensionViewsApi, "update">;
  workspaces: Pick<ExtensionWorkspacesApi, "delete">;
  browser: {
    execute(): Promise<{ outcome: CommandOutcome }>;
    saveTicket(): Promise<unknown>;
    call(capability: "extension.settings.delete", input: { key: string }): Promise<void>;
    resolve(input: NotifyInput): Promise<Notification | { resolved: number; notifications: Notification[] }>;
  };
  http: { stream(): AsyncIterable<CommandStreamClientEvent> };
};

export type ProposalApi = Omit<
  CurrentApi,
  "notify" | "packageFiles" | "extensionFiles" | "workspaceFiles" | "artifacts" | "browser" | "http"
> & {
  notify: {
    transition(input: { selector: Selector; status: AuthorStatus }): Promise<{ notifications: Notification[] }>;
  };
  files: {
    open(input: { root: "package" }): Promise<ReadFiles>;
    open(input: Exclude<FileRoot, { root: "package" }>): Promise<ArtifactMount>;
  };
  browser: {
    execute(): Promise<CommandOutcome>;
    saveTicket(): Promise<unknown>;
    settings: Pick<ExtensionSettingsApi, "delete">;
  };
  commands: { stream(): CommandStream };
};

export type RevisedApi = Omit<ProposalApi, "notify" | "files" | "storage" | "sessions" | "browser"> & {
  notify: {
    setStatus(id: string, status: AuthorStatus): Promise<Notification | null>;
    setStatusByKey(dedupeKey: string, status: AuthorStatus): Promise<Notification[]>;
  };
  files: {
    package: ReadFiles;
    local: ArtifactMount;
    currentWorkspace: ArtifactMount;
    defaultWorkspace: ArtifactMount;
    shared(id: string): ArtifactMount;
  };
  storage: Pick<ExtensionStorageApi, "records" | "assets"> & {
    records: Records & {
      save(record: StorageRecord, value: JsonValue, options: SaveOptions): ReturnType<Records["commit"]>;
    };
    attachments: {
      add(parentRecordId: string, file: File, options: SaveOptions): Promise<{ recordId: string }>;
    };
  };
  sessions: Pick<ExtensionSessionsApi, "query"> & { iterate(filter: SessionFilter): AsyncIterable<Session> };
  browser: ProposalApi["browser"] & { execute(): Promise<CommandOutcome> };
};

export type Inputs = {
  notificationId: string;
  dedupeKey: string;
  workspaceId: string;
  sessionId: string;
  ticketId: string;
  ticket: StorageRecord;
  title: string;
  file: File;
  saveId: string;
  uploadId: string;
};

export const tasks = [
  "completeNotification",
  "completeNotificationsByKey",
  "readTemplate",
  "writeLocalDraft",
  "writeSharedFile",
  "editCurrentWorkspace",
  "saveTicket",
  "attachFile",
  "listWorkspaceSessions",
  "linkSession",
  "readRejection",
  "consumeStream",
  "resetSetting",
  "deleteWorkspace",
  "saveView",
] as const;

export type Task = (typeof tasks)[number];
export const designs = ["current", "proposal", "revised"] as const;
export type Design = (typeof designs)[number];
