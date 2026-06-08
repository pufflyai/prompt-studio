import type {
  CommandHelpersApi,
  CommandInvocation,
  CommandMiddlewareResult,
  CommandNotice,
  CommandSource,
  WorkbenchAttachmentInvocationContext,
} from "./commands";
import type { EventDeliveryResult, EventRef } from "./events";
import type { JsonObject, MaybePromise, Struct } from "./json";
import type { RepoContext, ResourceAnchor, ResourceRef } from "./resources";
import type { SlotInvocationContext } from "./slots";

export interface ExtensionStorageCollectionApi<TItem = unknown> {
  get(id: string): Promise<TItem | undefined>;
  list(): Promise<TItem[]>;
  put(id: string, value: TItem): Promise<void>;
  create(value: TItem): Promise<TItem & { id: string }>;
  delete(id: string): Promise<void>;
  attachments(itemId: string): ExtensionBlobsApi;
}

export type StorageScope =
  | { type: "project" }
  | { type: "repo"; repoId: string }
  | { type: "resource"; resource: ResourceRef }
  | { type: string; id: string };

export interface ExtensionStorageApi {
  scope(scope: StorageScope): ExtensionStorageApi;
  files: ExtensionBlobsApi;
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  collection<TItem = unknown>(name: string): ExtensionStorageCollectionApi<TItem>;
}

export interface ExtensionBlobRef {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  hash: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionBlobInput {
  name: string;
  data: Uint8Array | ArrayBuffer;
  mimeType?: string | null;
}

export interface ExtensionBlobsApi {
  put(input: ExtensionBlobInput): Promise<ExtensionBlobRef>;
  get(id: string): Promise<ExtensionBlobRef | undefined>;
  getBytes(id: string): Promise<Uint8Array>;
  list(): Promise<ExtensionBlobRef[]>;
  delete(id: string): Promise<void>;
  urlFor(id: string): string;
}

export interface ArtifactFile {
  path: string;
  size?: number;
  updatedAt?: string;
}

export interface ArtifactMount {
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, value: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, value: Uint8Array): Promise<void>;
  list(pattern?: string): Promise<ArtifactFile[]>;
  listDirs(path?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
}

export interface ExtensionArtifactApi {
  mount(key: string): ArtifactMount;
}

export interface ExtensionFilesApi {
  readText(fileId: string): Promise<string>;
  writeText(fileId: string, value: string): Promise<void>;
  createText(input: { name: string; content: string; metadata?: JsonObject }): Promise<{ id: string }>;
  delete(fileId: string): Promise<void>;
}

export interface ExtensionSessionsApi {
  create(input: {
    title: string;
    prompt?: string;
    template?: string;
    vars?: JsonObject;
    harness?: ExtensionHarnessInput;
    workspaceId?: string;
    repoId?: string;
    anchors?: ResourceAnchor[];
    originalSessionId?: string;
  }): Promise<{ id: string }>;

  followup(input: { sessionId: string; prompt?: string; template?: string; vars?: JsonObject }): Promise<void>;
}

export interface ExtensionHarnessInput {
  harnessId: string;
  model?: string;
}

/** @deprecated Legacy core ticket extension API. Ticket data is owned by the pstdio tickets extension. */
export interface ExtensionTicket {
  id: string;
  shorthand: string;
  created_at?: string;
  updated_at?: string;
  display_title?: string | null;
  displayTitle?: string | null;
  user_prompt?: string | null;
  userPrompt?: string | null;
  parent_id?: string | null;
  parentId?: string | null;
  draft?: boolean;
  archived?: boolean;
  status_id?: string | null;
  status?: string | null;
  status_name?: string | null;
  tag_ids?: string[];
  tag_names?: string[];
  tagIds?: string[];
  tagNames?: string[];
  file_id?: string | null;
  fileId?: string | null;
  fileIds?: string[];
}

/** @deprecated Legacy core ticket extension API. Ticket data is owned by the pstdio tickets extension. */
export interface ExtensionTicketFile {
  id: string;
  file_name?: string | null;
  fileName?: string | null;
  file_kind?: string | null;
  fileKind?: string | null;
  mime_type?: string | null;
  mimeType?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** @deprecated Legacy core ticket extension API. Ticket data is owned by the pstdio tickets extension. */
export interface ExtensionTicketListInput {
  status?: string;
  tag?: string | string[];
  archived?: boolean;
  draft?: boolean;
  parentId?: string;
  shorthand?: string;
  search?: string;
}

export interface ExtensionWorkspace {
  id: string;
  project_id?: string;
  workspace_shorthand?: string;
  /** @deprecated Legacy ticket-workspace linkage. Ticket data is owned by the pstdio tickets extension. */
  ticket_id?: string | null;
  /** @deprecated Legacy ticket-workspace linkage. Ticket data is owned by the pstdio tickets extension. */
  ticket_shorthand?: string | null;
  branch?: string | null;
  worktree_path?: string | null;
  attempt_status_id?: string | null;
  attempt_status_name?: string | null;
  initializing?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** @deprecated Legacy core ticket extension API. Ticket data is owned by the pstdio tickets extension. */
export interface ExtensionTicketsApi {
  list(input?: ExtensionTicketListInput): Promise<ExtensionTicket[]>;
  get(ref: string): Promise<ExtensionTicket>;
  update(input: { ticket: string; content?: string }): Promise<ExtensionTicket>;
  listFiles(ref: string): Promise<ExtensionTicketFile[]>;
  createAttempt(input: {
    ticket: string;
    agent?: string;
    branch?: string;
    repoId?: string;
    repoPath?: string;
    mode?: "worktree" | "current_branch";
    model?: string;
    prompt?: string;
    base?: string;
    startSession?: boolean;
  }): Promise<unknown>;
  setStatus(input: { ticket: string; status: string }): Promise<void>;
  updateWhenAllAttemptsMatch(input: {
    ticket: string;
    allAttemptsStatus: string;
    setStatus: string;
  }): Promise<{ updated: boolean }>;
}

/** @deprecated Legacy core ticket status extension API. Ticket statuses are owned by the pstdio tickets extension. */
export interface ExtensionTicketStatus {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  canCreate: boolean;
  canDragIn: boolean;
  canDragOut: boolean;
  columnActions: string[];
}

/** @deprecated Legacy core ticket status extension API. Ticket statuses are owned by the pstdio tickets extension. */
export interface ExtensionTicketStatusesApi {
  list(): Promise<ExtensionTicketStatus[]>;
  create(input: {
    name: string;
    color: string;
    sortOrder?: number;
    isDefault?: boolean;
    canCreate?: boolean;
    canDragIn?: boolean;
    canDragOut?: boolean;
    columnActions?: string[];
  }): Promise<ExtensionTicketStatus>;
  update(input: {
    statusId: string;
    name?: string;
    color?: string;
    sortOrder?: number;
    canCreate?: boolean;
    canDragIn?: boolean;
    canDragOut?: boolean;
    columnActions?: string[];
  }): Promise<ExtensionTicketStatus>;
  setDefault(input: { statusId: string }): Promise<void>;
  delete(input: { statusId: string }): Promise<void>;
}

/** @deprecated Legacy ticket attempt status extension API. Workspace status automation is extension-owned. */
export interface ExtensionAttemptStatus {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
}

/** @deprecated Legacy ticket attempt status extension API. Workspace status automation is extension-owned. */
export interface ExtensionAttemptStatusesApi {
  list(): Promise<ExtensionAttemptStatus[]>;
  create(input: {
    name: string;
    color: string;
    sortOrder?: number;
    isDefault?: boolean;
  }): Promise<ExtensionAttemptStatus>;
  update(input: {
    statusId: string;
    name?: string;
    color?: string;
    sortOrder?: number;
    isDefault?: boolean;
  }): Promise<ExtensionAttemptStatus>;
  delete(input: { statusId: string }): Promise<void>;
}

export interface SetAttemptStatusInput {
  workspaceId: string;
  status: string;
  sessionId?: string;
}

export interface SetAttemptStatusResult {
  id: string;
  attempt_status_id: string | null;
  from_status: string | null;
  to_status: string;
  status_change_id: string;
}

export interface ExtensionWorkspacesApi {
  list(): Promise<ExtensionWorkspace[]>;
  get(id: string): Promise<ExtensionWorkspace | null>;
  getByShorthand(shorthand: string): Promise<ExtensionWorkspace | null>;
  create(input: JsonObject): Promise<ExtensionWorkspace>;
  archive(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  setAttemptStatus(input: SetAttemptStatusInput): Promise<SetAttemptStatusResult>;
}

export interface BootstrapWorktreeInput {
  repoPath: string;
  worktreePath: string;
  /** @deprecated Legacy ticket worktree bootstrap. Ticket worktree setup is owned by the pstdio tickets extension. */
  ticketId?: string;
}

/** @deprecated Legacy ticket worktree cleanup. Ticket worktree setup is owned by the pstdio tickets extension. */
export interface RemoveWorktreesForTicketInput {
  ticketId?: string;
}

export interface ExtensionWorktreesApi {
  bootstrap(input: BootstrapWorktreeInput): Promise<void>;
  /** @deprecated Legacy ticket worktree cleanup. Ticket worktree setup is owned by the pstdio tickets extension. */
  removeAllForTicket(input: RemoveWorktreesForTicketInput): Promise<number>;
}

export interface ExtensionReposApi {
  list(): Promise<RepoContext[]>;
  get(repoId: string): Promise<RepoContext>;
  getDefault(): Promise<RepoContext | undefined>;
  resolvePath(repoId: string, relativePath: string, options?: { basePath?: string }): Promise<string>;
}

export interface ExtensionEventsApi {
  emit<TPayload extends Struct>(event: EventRef<TPayload> | string, payload: TPayload): Promise<EventDeliveryResult>;
}

export interface ExtensionActivityApi {
  record(input: {
    message: string;
    target?: ResourceRef;
    related?: ResourceRef[];
    metadata?: JsonObject;
  }): Promise<{ id: string }>;
}

export interface ExtensionNotifyApi {
  toast(notice: CommandNotice): Promise<void>;
}

export interface ProcessRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ProcessRunInput {
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ExtensionProcessApi {
  run(input: ProcessRunInput): Promise<ProcessRunResult>;
  runOrThrow(input: ProcessRunInput): Promise<ProcessRunResult>;
  spawnDetached(input: { command: string[]; cwd?: string; env?: Record<string, string> }): Promise<{ pid?: number }>;
}

export interface ExtensionNetApi {
  findFreePort(input?: { host?: string }): Promise<number>;
}

export interface ExtensionLoggerApi {
  info(message: string, metadata?: JsonObject): void;
  warn(message: string, metadata?: JsonObject): void;
  error(message: string, metadata?: JsonObject): void;
}

export interface ExtensionSettingsApi<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  all(): Promise<Partial<TSettings>>;
  get<TKey extends keyof TSettings & string>(key: TKey): Promise<TSettings[TKey] | undefined>;
  set<TKey extends keyof TSettings & string>(key: TKey, value: TSettings[TKey]): Promise<void>;
  delete<TKey extends keyof TSettings & string>(key: TKey): Promise<void>;
}

export interface ExtensionContextBase<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  projectId: string;
  extensionId: string;
  /** Extension package name. Used for grouping/prefixing user-facing references. */
  name: string;
  repo?: RepoContext;
  source?: CommandSource;
  storage: ExtensionStorageApi;
  artifacts: ExtensionArtifactApi;
  /** Working tree of the invocation's repo, scoped to its root. Absent for non-repo (event/hook) invocations. */
  repoFiles?: ArtifactMount;
  files: ExtensionFilesApi;
  /** @deprecated Legacy core ticket extension API. Ticket data is owned by the pstdio tickets extension. */
  tickets: ExtensionTicketsApi;
  /** @deprecated Legacy core ticket status extension API. Ticket statuses are owned by the pstdio tickets extension. */
  ticketStatuses: ExtensionTicketStatusesApi;
  /** @deprecated Legacy ticket attempt status extension API. Workspace status automation is extension-owned. */
  attemptStatuses: ExtensionAttemptStatusesApi;
  sessions: ExtensionSessionsApi;
  workspaces: ExtensionWorkspacesApi;
  worktrees: ExtensionWorktreesApi;
  repos: ExtensionReposApi;
  commands: CommandHelpersApi;
  events: ExtensionEventsApi;
  activity: ExtensionActivityApi;
  notify: ExtensionNotifyApi;
  process: ExtensionProcessApi;
  net: ExtensionNetApi;
  logger: ExtensionLoggerApi;
  settings: ExtensionSettingsApi<TSettings>;
}

export interface CommandContext<
  TParams extends Struct = Struct,
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> extends ExtensionContextBase<TSettings> {
  commandId: string;
  invocationId: string;
  invocation: CommandInvocation<TParams>;
  resource?: ResourceRef;
  attachment?: WorkbenchAttachmentInvocationContext;
  slot?: SlotInvocationContext;
  params: TParams;
}

export type CommandMiddlewareContext<TParams extends Struct = Struct> = CommandContext<TParams>;

export type CommandMiddlewareHandler<TParams extends Struct = Struct> = (
  ctx: CommandMiddlewareContext<TParams>,
) => MaybePromise<CommandMiddlewareResult<TParams>>;

export type CommandRunHandler<
  TParams extends Struct = Struct,
  TResult = unknown,
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> = (ctx: CommandContext<TParams, TSettings>) => MaybePromise<TResult>;

export interface EventContext extends ExtensionContextBase {
  eventId: string;
  deliveryId: string;
}

export type SetupContext = ExtensionContextBase;
export type MigrationContext = ExtensionContextBase;
