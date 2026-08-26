import type { TerminalSessionHandle, TerminalSessionRequest } from "../../extensions.terminal";
import type { CreateNotificationInput, Notification, NotificationStatus } from "../../notifications/types";
import type { SessionAttachmentRef, SessionStatus } from "../../sessions";
import type { Skill } from "../../skills";
import type { TemplateWithContent } from "../../templates";
import type {
  CommandHelpersApi,
  CommandMiddlewareResult,
  CommandNotice,
  CommandSource,
  WorkbenchAttachmentInvocationContext,
} from "./commands";
import type { EventDeliveryResult, EventRef } from "./events";
import type { JsonObject, MaybePromise, Struct } from "./json";
import type { RendererContext, RepoContext, ResourceAnchor, ResourceRef } from "./resources";
import type { SlotInvocationContext } from "./slots";
import type { ExtensionWorkspacesApi } from "./workspaces";

export interface ExtensionStorageCollectionApi<TItem = unknown> {
  get(id: string): Promise<TItem | undefined>;
  list(): Promise<TItem[]>;
  put(id: string, value: TItem): Promise<void>;
  createIfAbsent(id: string, value: TItem): Promise<boolean>;
  deleteIfValue(id: string, value: TItem): Promise<boolean>;
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

export interface WorkspaceSyncFile {
  /** Path relative to the `dir` passed to {@link WorkspaceFilesMount.syncDir}. */
  path: string;
  content: string;
}

export interface WorkspaceFilesMount extends ArtifactMount {
  /**
   * Reconcile `dir` to exactly `files`: write each file atomically (temp + rename) and prune anything
   * else under `dir`. Idempotent — safe to re-run on every catalog change; a live agent's dir-watcher
   * only ever sees complete files.
   */
  syncDir(dir: string, files: WorkspaceSyncFile[]): Promise<void>;
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

export interface ExtensionSkillsApi {
  /** The project's resolved skill catalog (DB skills + extension-contributed skills, deduped). */
  list(): Promise<Skill[]>;
}

export interface ExtensionTemplatesApi {
  /** The project's resolved template catalog, including enabled extension templates and project overrides. */
  get(name: string): Promise<TemplateWithContent | null>;
}

export interface ExtensionSessionResource {
  type: "session";
  id: string;
  title: string;
  status: SessionStatus;
}

export interface ExtensionSessionsApi {
  get(id: string): Promise<{
    id: string;
    title: string;
    status?: string;
    original_session_id?: string | null;
    cwd?: string | null;
    updated_at?: string | null;
    anchors_json?: ResourceAnchor[];
  } | null>;

  list(): Promise<
    Array<{
      id: string;
      title: string;
      status: SessionStatus;
      last_request_started?: string | null;
      last_request_ended?: string | null;
      updated_at?: string | null;
      anchors_json?: ResourceAnchor[];
    }>
  >;

  /** Sessions linked to a workspace (via the workspace-session join), oldest first. */
  listByWorkspace(workspaceId: string): Promise<
    Array<{
      id: string;
      title: string;
      status: SessionStatus;
      created_at?: string | null;
      updated_at?: string | null;
      anchors_json?: ResourceAnchor[];
    }>
  >;

  create(input: {
    title: string;
    prompt?: string;
    template?: string;
    vars?: JsonObject;
    harness?: ExtensionHarnessInput;
    workspaceId?: string;
    repoId?: string;
    anchors?: ResourceAnchor[];
    attachments?: SessionAttachmentRef[];
    originalSessionId?: string;
  }): Promise<ExtensionSessionResource>;

  followup(input: {
    sessionId: string;
    prompt?: string;
    template?: string;
    vars?: JsonObject;
    attachments?: SessionAttachmentRef[];
  }): Promise<void>;

  addAnchors(sessionId: string, anchors: ResourceAnchor[]): Promise<void>;
}

export interface ExtensionHarnessInput {
  harnessId: string;
  model?: string;
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
  action(input: Omit<CreateNotificationInput, "projectId">): Promise<Notification>;
  resolve(input: {
    id?: string;
    dedupeKey?: string;
    status?: Extract<NotificationStatus, "done" | "dismissed" | "expired">;
  }): Promise<Notification[]>;
  dismiss(input: { id?: string; dedupeKey?: string }): Promise<Notification[]>;
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

export type { TerminalEvent, TerminalSessionHandle, TerminalSessionRequest } from "../../extensions.terminal";

/** Opens long-lived, interactive PTY sessions. Complements {@link ExtensionProcessApi}'s run-to-completion model. */
export interface ExtensionTerminalApi {
  openSession(request: TerminalSessionRequest): TerminalSessionHandle;
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

export interface ExtensionProjectContext {
  id: string;
  name: string;
  shorthand: string;
}

export interface ExtensionContextBase<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  projectId: string;
  /** Host workspace id when the command runs from inside a worktree-backed workspace. */
  workspaceId?: string;
  project: ExtensionProjectContext;
  extensionId: string;
  /** Extension package name. Used for grouping/prefixing user-facing references. */
  name: string;
  repo?: RepoContext;
  source?: CommandSource;
  storage: ExtensionStorageApi;
  artifacts: ExtensionArtifactApi;
  /** Working tree of the invocation's repo, scoped to its root. Absent for non-repo (event/hook) invocations. */
  repoFiles?: ArtifactMount;
  /** Files of the workspace this context targets, scoped to its working dir. */
  workspaceFiles?: WorkspaceFilesMount;
  files: ExtensionFilesApi;
  /** Project skill catalog. Present where the host wires it (command/event contexts). */
  skills?: ExtensionSkillsApi;
  templates: ExtensionTemplatesApi;
  sessions: ExtensionSessionsApi;
  workspaces: ExtensionWorkspacesApi;
  repos: ExtensionReposApi;
  commands: CommandHelpersApi;
  events: ExtensionEventsApi;
  activity: ExtensionActivityApi;
  notify: ExtensionNotifyApi;
  process: ExtensionProcessApi;
  /** Interactive PTY sessions. Present only where the host wires a terminal supervisor (e.g. the workbench panel). */
  terminal?: ExtensionTerminalApi;
  net: ExtensionNetApi;
  logger: ExtensionLoggerApi;
  settings: ExtensionSettingsApi<TSettings>;
}

export interface CommandContext<TSettings extends Record<string, unknown> = Record<string, unknown>>
  extends ExtensionContextBase<TSettings> {
  commandId: string;
  invocationId: string;
  invocation: {
    readonly source?: CommandSource;
    readonly attachment?: WorkbenchAttachmentInvocationContext;
    readonly slot?: SlotInvocationContext;
    readonly metadata?: JsonObject;
  };
  resource?: ResourceRef;
  attachment?: WorkbenchAttachmentInvocationContext;
  slot?: SlotInvocationContext;
}

export type CommandMiddlewareContext = CommandContext;

export type CommandMiddlewareHandler<TParams extends Struct = Struct> = (
  ctx: CommandMiddlewareContext,
  params: TParams,
) => MaybePromise<CommandMiddlewareResult<TParams>>;

export type CommandRunHandler<
  TParams extends Struct = Struct,
  TResult = unknown,
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> = (ctx: CommandContext<TSettings>, params: TParams) => MaybePromise<TResult>;

export type RendererCallback<
  TInput extends Struct = Struct,
  TResult = unknown,
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> = (ctx: ExtensionContextBase<TSettings>, input: TInput & { renderer: RendererContext }) => MaybePromise<TResult>;

export interface EventContext extends ExtensionContextBase {
  eventId: string;
  deliveryId: string;
}

export type SetupContext = ExtensionContextBase;
export type MigrationContext = ExtensionContextBase;
