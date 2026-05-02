/*
 * Prompt Studio Extension SDK type sketch.
 *
 * Current model:
 * - commands are executable operations
 * - middlewares intercept commands and may modify or reject an invocation
 * - hooks subscribe to events
 * - events are emitted signals/facts, including automatic command lifecycle events
 * - command panel visibility is on by default for all commands
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
export type MaybePromise<T> = T | Promise<T>;
export type Struct = object;

export type CommandSource = "cli" | "dashboard" | "api" | "schedule" | "event" | "automation" | "command-panel";
export type ResourceRole = "primary" | "context" | "source" | "result";

export interface ResourceRef {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: JsonObject;
}

export interface ResourceAnchor extends ResourceRef {
  role?: ResourceRole;
}

export interface RepoContext {
  projectId: string;
  repoId: string;
  path: string;
  remote?: string | null;
  role?: "default" | "selected" | "workspace";
}

export interface WorkspaceContext {
  projectId: string;
  repoId: string;
  repoPath: string;
  worktreePath: string;
  branch: string;
}

export interface PackageAssetDescriptor {
  kind: "package-asset";
  path: string;
  baseUrl: string;
}

export declare function packageAsset(path: string, baseUrl: string): PackageAssetDescriptor;

// ---------------------------------------------------------------------------
// Refs and contracts
// ---------------------------------------------------------------------------

export interface CommandRef<TParams extends Struct = Struct, TResult = unknown> {
  id: string;
  params?: TParams;
  result?: TResult;
}

export declare function commandRef<TParams extends Struct = Struct, TResult = unknown>(
  id: string,
): CommandRef<TParams, TResult>;

export interface EventRef<TPayload extends Struct = Struct> {
  id: string;
  payload?: TPayload;
}

export declare function eventRef<TPayload extends Struct = Struct>(id: string): EventRef<TPayload>;

export type CommandLifecyclePhase = "requested" | "started" | "completed" | "rejected" | "failed";

export interface CommandRequestedEvent<TParams extends Struct = Struct> {
  commandId: string;
  invocationId: string;
  source?: CommandSource;
  params: TParams;
  resource?: ResourceRef;
  repo?: RepoContext;
}

export interface CommandStartedEvent<TParams extends Struct = Struct> extends CommandRequestedEvent<TParams> {}

export interface CommandCompletedEvent<TParams extends Struct = Struct, TResult = unknown>
  extends CommandStartedEvent<TParams> {
  result: TResult;
  elapsedMs: number;
}

export interface CommandRejectedEvent<TParams extends Struct = Struct> extends CommandRequestedEvent<TParams> {
  code?: string;
  reason: string;
  data?: JsonObject;
}

export interface SerializedError {
  name?: string;
  message: string;
  stack?: string;
  cause?: JsonValue;
}

export interface CommandFailedEvent<TParams extends Struct = Struct> extends CommandRequestedEvent<TParams> {
  code?: string;
  reason: string;
  error?: SerializedError;
  elapsedMs: number;
}

export type CommandLifecycleEventPayload<
  TPhase extends CommandLifecyclePhase,
  TParams extends Struct = Struct,
  TResult = unknown,
> = TPhase extends "requested"
  ? CommandRequestedEvent<TParams>
  : TPhase extends "started"
    ? CommandStartedEvent<TParams>
    : TPhase extends "completed"
      ? CommandCompletedEvent<TParams, TResult>
      : TPhase extends "rejected"
        ? CommandRejectedEvent<TParams>
        : CommandFailedEvent<TParams>;

export declare function commandEvent<
  TPhase extends CommandLifecyclePhase,
  TParams extends Struct = Struct,
  TResult = unknown,
>(
  command: CommandRef<TParams, TResult> | string,
  phase: TPhase,
): EventRef<CommandLifecycleEventPayload<TPhase, TParams, TResult>>;

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

export type UiSlotKind = "menu" | "navigation" | "view" | "settings" | "renderer";

export interface SlotOptions<TKind extends UiSlotKind = UiSlotKind> {
  kind: TKind;
  label?: string;
  description?: string;
  metadata?: JsonObject;
}

export interface SlotRef<TContext extends Struct = Struct, TKind extends UiSlotKind = UiSlotKind> {
  id: string;
  kind: TKind;
  label?: string;
  context?: TContext;
}

export interface SlotInvocationContext<TContext extends Struct = Struct> {
  id: string;
  kind: UiSlotKind;
  context: TContext;
}

export declare function defineSlot<TContext extends Struct = Struct, TKind extends UiSlotKind = UiSlotKind>(
  id: string,
  options: SlotOptions<TKind>,
): SlotRef<TContext, TKind>;

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export type ParamType =
  | "text"
  | "longtext"
  | "number"
  | "boolean"
  | "select"
  | "multi-select"
  | "repo"
  | "harness"
  | "template"
  | "resource"
  | "json";

export interface ParamDescriptor<TValue = unknown> {
  type: ParamType;
  label?: string;
  description?: string;
  required?: boolean;
  defaultValue?: TValue;
  options?: Array<{ label: string; value: string }>;
  templateType?: string;
  resourceType?: string;
  metadata?: JsonObject;
}

export type ParamObjectSchema = Record<string, ParamDescriptor>;

export declare const params: {
  text(options?: Omit<ParamDescriptor<string>, "type">): ParamDescriptor<string>;
  longText(options?: Omit<ParamDescriptor<string>, "type">): ParamDescriptor<string>;
  number(options?: Omit<ParamDescriptor<number>, "type">): ParamDescriptor<number>;
  boolean(options?: Omit<ParamDescriptor<boolean>, "type">): ParamDescriptor<boolean>;
  select(
    options: Omit<ParamDescriptor<string>, "type"> & {
      options: Array<{ label: string; value: string }>;
    },
  ): ParamDescriptor<string>;
  multiSelect(
    options: Omit<ParamDescriptor<string[]>, "type"> & {
      options: Array<{ label: string; value: string }>;
    },
  ): ParamDescriptor<string[]>;
  repo(options?: Omit<ParamDescriptor<{ repoId: string; branch?: string }>, "type">): ParamDescriptor<{
    repoId: string;
    branch?: string;
  }>;
  harness(options?: Omit<ParamDescriptor<{ harnessId: string; model?: string }>, "type">): ParamDescriptor<{
    harnessId: string;
    model?: string;
  }>;
  template(options: Omit<ParamDescriptor<string>, "type"> & { type: string }): ParamDescriptor<string>;
  resource(
    options: Omit<ParamDescriptor<ResourceRef>, "type"> & { resourceType: string },
  ): ParamDescriptor<ResourceRef>;
  json<T = unknown>(options?: Omit<ParamDescriptor<T>, "type">): ParamDescriptor<T>;
};

// ---------------------------------------------------------------------------
// CLI and command panel
// ---------------------------------------------------------------------------

export interface CliContribution {
  /**
   * Path under the extension namespace. For namespace "planner",
   * path ["tickets", "create"] becomes: pstdio planner tickets create.
   */
  path?: string[];
  globalAliases?: string[][];
  description?: string;
  examples?: string[];
  hidden?: boolean;
}

export interface CommandPanelContribution {
  group?: string;
  keywords?: string[];
  when?: WhenExpression;
}

export interface CliCommandRecord {
  extensionId: string;
  namespace: string;
  commandId: string;
  localCommandId: string;
  path: string[];
  title: string;
  description?: string;
  params: ParamObjectSchema;
}

// ---------------------------------------------------------------------------
// UI contributions
// ---------------------------------------------------------------------------

export interface WhenExpression {
  source?: CommandSource[];
  resourceType?: string[];
  metadata?: JsonObject;
}

export interface MenuContribution<TSlotContext extends Struct = Struct, TParams extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "menu"> | string;
  label?: string;
  group?: string;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  command?: CommandRef<TParams, unknown> | string;
  params?: Partial<TParams>;
  presentation?: "menu-item" | "button" | "icon-button";
}

export interface NavigationContribution<TSlotContext extends Struct = Struct, TParams extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "navigation"> | string;
  label: string;
  group?: string;
  placement?: "first" | "default" | "last";
  route?: string;
  href?: string;
  command?: CommandRef<TParams, unknown> | string;
  params?: Partial<TParams>;
  icon?: string;
  when?: WhenExpression;
}

export interface WebviewContribution {
  entry: PackageAssetDescriptor;
  title?: string;
  sandbox?: "default" | "strict";
}

export interface ViewContribution<TSlotContext extends Struct = Struct> {
  title: string;
  slot: SlotRef<TSlotContext, "view"> | string;
  group?: string;
  placement?: "first" | "default" | "last";
  webview: WebviewContribution;
}

export interface RouteContribution {
  path: string;
  label: string;
  webview: WebviewContribution;
}

export interface SettingsPanelContribution<TSlotContext extends Struct = Struct> {
  title: string;
  slot: SlotRef<TSlotContext, "settings"> | string;
  webview: WebviewContribution;
}

export interface RendererContribution<TSlotContext extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "renderer"> | string;
  for: string;
  webview: WebviewContribution;
}

// ---------------------------------------------------------------------------
// Command invocation, middleware, and outcomes
// ---------------------------------------------------------------------------

export interface CommandInvocation<TParams extends Struct = Struct> {
  params: TParams;
  resource?: ResourceRef;
  repoId?: string;
  repoPath?: string;
  slot?: SlotInvocationContext;
  metadata?: JsonObject;
}

export interface CommandContinue {
  type: "continue";
}

export interface CommandPatchParams<TParams extends Struct = Struct> {
  type: "patchParams";
  params: Partial<TParams>;
}

export interface CommandReplaceParams<TParams extends Struct = Struct> {
  type: "replaceParams";
  params: TParams;
}

export interface CommandReplaceInvocation<TParams extends Struct = Struct> {
  type: "replaceInvocation";
  invocation: CommandInvocation<TParams>;
}

export interface CommandReject {
  type: "reject";
  code?: string;
  reason: string;
  data?: JsonObject;
}

export type CommandMiddlewareResult<TParams extends Struct = Struct> =
  | void
  | CommandContinue
  | CommandPatchParams<TParams>
  | CommandReplaceParams<TParams>
  | CommandReplaceInvocation<TParams>
  | CommandReject;

export interface CommandNotice {
  type: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  metadata?: JsonObject;
}

export interface CommandDiagnostic {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  extensionId?: string;
  commandId?: string;
  metadata?: JsonObject;
}

export type CommandOutcome<TResult = unknown> =
  | {
      ok: true;
      status: "success";
      value: TResult;
      notices?: CommandNotice[];
      diagnostics?: CommandDiagnostic[];
    }
  | {
      ok: false;
      status: "rejected";
      code?: string;
      reason: string;
      data?: JsonObject;
      notices?: CommandNotice[];
      diagnostics?: CommandDiagnostic[];
    }
  | {
      ok: false;
      status: "error";
      code?: string;
      reason: string;
      error?: SerializedError;
      notices?: CommandNotice[];
      diagnostics?: CommandDiagnostic[];
    };

export interface CommandHelpersApi {
  execute<TParams extends Struct = Struct, TResult = unknown>(
    command: CommandRef<TParams, TResult> | string,
    invocation: CommandInvocation<TParams>,
  ): Promise<CommandOutcome<TResult>>;

  continue(): CommandContinue;
  patchParams<TParams extends Struct = Struct>(params: Partial<TParams>): CommandPatchParams<TParams>;
  replaceParams<TParams extends Struct = Struct>(params: TParams): CommandReplaceParams<TParams>;
  replaceInvocation<TParams extends Struct = Struct>(
    invocation: CommandInvocation<TParams>,
  ): CommandReplaceInvocation<TParams>;
  reject(input: Omit<CommandReject, "type">): CommandReject;
}

// ---------------------------------------------------------------------------
// Runtime APIs
// ---------------------------------------------------------------------------

export interface ExtensionStorageCollectionApi<TItem = unknown> {
  get(id: string): Promise<TItem | undefined>;
  list(): Promise<TItem[]>;
  put(id: string, value: TItem): Promise<void>;
  create(value: TItem): Promise<TItem & { id: string }>;
  delete(id: string): Promise<void>;
}

export type StorageScope =
  | { type: "project" }
  | { type: "repo"; repoId?: string }
  | { type: "resource"; resource?: ResourceRef }
  | { type: string; id?: string };

export interface ExtensionStorageApi {
  scope(scope: StorageScope): ExtensionStorageApi;
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  collection<TItem = unknown>(name: string): ExtensionStorageCollectionApi<TItem>;
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
    harness?: unknown;
    workspaceId?: string;
    repoId?: string;
    anchors?: ResourceAnchor[];
    originalSessionId?: string;
  }): Promise<{ id: string }>;

  followup(input: { sessionId: string; prompt?: string; template?: string; vars?: JsonObject }): Promise<void>;
}

export interface ExtensionWorkspacesApi {
  get(id: string): Promise<unknown>;
  create(input: JsonObject): Promise<unknown>;
  archive(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ExtensionReposApi {
  list(): Promise<RepoContext[]>;
  get(repoId: string): Promise<RepoContext>;
  getDefault(): Promise<RepoContext | undefined>;
  resolvePath(repoId: string, relativePath: string, options?: { basePath?: string }): Promise<string>;
}

export interface EventDeliveryResult {
  delivered: number;
  diagnostics?: CommandDiagnostic[];
}

export interface ExtensionEventsApi {
  emit<TPayload extends Struct>(event: EventRef<TPayload> | string, payload: TPayload): Promise<EventDeliveryResult>;
}

export interface ExtensionActivityApi {
  record(input: { message: string; target?: ResourceRef; related?: ResourceRef[]; metadata?: JsonObject }): Promise<{
    id: string;
  }>;
}

export interface ExtensionNotifyApi {
  toast(notice: CommandNotice): Promise<void>;
}

export interface ProcessRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ExtensionProcessApi {
  run(input: {
    command: string[];
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
  }): Promise<ProcessRunResult>;
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

export interface ExtensionContextBase {
  projectId: string;
  extensionId: string;
  namespace: string;
  repo?: RepoContext;
  source?: CommandSource;
  storage: ExtensionStorageApi;
  artifacts: ExtensionArtifactApi;
  files: ExtensionFilesApi;
  sessions: ExtensionSessionsApi;
  workspaces: ExtensionWorkspacesApi;
  repos: ExtensionReposApi;
  commands: CommandHelpersApi;
  events: ExtensionEventsApi;
  activity: ExtensionActivityApi;
  notify: ExtensionNotifyApi;
  process: ExtensionProcessApi;
  net: ExtensionNetApi;
  logger: ExtensionLoggerApi;
}

export interface CommandContext<TParams extends Struct = Struct> extends ExtensionContextBase {
  commandId: string;
  invocationId: string;
  invocation: CommandInvocation<TParams>;
  resource?: ResourceRef;
  slot?: SlotInvocationContext;
  params: TParams;
}

export interface CommandMiddlewareContext<TParams extends Struct = Struct> extends CommandContext<TParams> {}

export type CommandMiddlewareHandler<TParams extends Struct = Struct> = (
  ctx: CommandMiddlewareContext<TParams>,
) => MaybePromise<CommandMiddlewareResult<TParams>>;

export type CommandRunHandler<TParams extends Struct = Struct, TResult = unknown> = (
  ctx: CommandContext<TParams>,
) => MaybePromise<TResult>;

export interface MiddlewareDefinition<TParams extends Struct = Struct, TResult = unknown> {
  command: CommandRef<TParams, TResult> | string;
  handler: CommandMiddlewareHandler<TParams>;
}

export interface EventContext extends ExtensionContextBase {
  eventId: string;
  deliveryId: string;
}

export interface HookDefinition<TPayload extends Struct = Struct> {
  event: EventRef<TPayload> | string;
  handler(ctx: EventContext, payload: TPayload): MaybePromise<void>;
}

// ---------------------------------------------------------------------------
// Extension contributions
// ---------------------------------------------------------------------------

export interface CommandDefinition<TParams extends Struct = Struct, TResult = unknown> {
  title: string;
  description?: string;
  params?: ParamObjectSchema;
  /** Defaults to true. */
  commandPanel?: boolean | CommandPanelContribution;
  menus?: MenuContribution[];
  cli?: boolean | CliContribution;
  run: CommandRunHandler<TParams, TResult>;
}

export interface ScheduleContribution<TParams extends Struct = Struct> {
  title: string;
  cron: string;
  command: CommandRef<TParams, unknown> | string;
  params?: TParams;
  repoId?: string;
  disabled?: boolean;
}

export interface ArtifactMountContribution {
  /** Relative path under .pstdio/<extension.namespace>/. */
  path: string;
  label: string;
  repoRole?: "default" | "selected" | "workspace";
}

export interface TemplateTypeContribution {
  label: string;
  description?: string;
}

export interface TemplateContribution {
  title: string;
  type: string;
  source: PackageAssetDescriptor;
  description?: string;
}

export interface SkillContribution {
  title: string;
  source: PackageAssetDescriptor;
  description?: string;
}

export interface HarnessDetectionResult {
  available: boolean;
  version?: string;
  reason?: string;
}

export interface HarnessRun {
  runId: string;
  pid?: number;
  metadata?: JsonObject;
}

export interface HarnessProvider {
  id: string;
  label: string;
  detect?(ctx: ExtensionContextBase): MaybePromise<HarnessDetectionResult>;
  start(
    ctx: ExtensionContextBase,
    input: { workspacePath: string; sessionId: string; prompt?: string },
  ): MaybePromise<HarnessRun>;
  send?(ctx: ExtensionContextBase, input: { runId: string; message: string }): MaybePromise<void>;
  stop?(ctx: ExtensionContextBase, input: { runId: string }): MaybePromise<void>;
}

export interface WorkspaceTypeProvider {
  id: string;
  label: string;
  create(ctx: ExtensionContextBase, input: JsonObject): MaybePromise<JsonObject>;
  resolve(ctx: ExtensionContextBase, workspace: JsonObject): MaybePromise<{ rootPath: string; displayPath?: string }>;
  archive?(ctx: ExtensionContextBase, workspace: JsonObject): MaybePromise<void>;
  delete?(ctx: ExtensionContextBase, workspace: JsonObject): MaybePromise<void>;
}

export interface LocalExtensionSource {
  name: string;
  path: string;
  origin?: string;
  installedAt: string;
  updatedAt: string;
}

export interface ProjectExtensionInstance {
  projectId: string;
  extensionId: string;
  namespace: string;
  sourceName: string;
  enabled: boolean;
  config: JsonObject;
}

export interface SetupContext extends ExtensionContextBase {}
export interface MigrationContext extends ExtensionContextBase {}

export interface ExtensionDefinition {
  id: string;
  namespace: string;
  name: string;
  version?: string;
  description?: string;
  settings?: ParamObjectSchema;

  slots?: Record<string, SlotRef>;
  routes?: Record<string, RouteContribution>;
  views?: Record<string, ViewContribution>;
  menus?: Record<string, MenuContribution>;
  navigation?: Record<string, NavigationContribution>;
  settingsPanels?: Record<string, SettingsPanelContribution>;
  activityRenderers?: Record<string, RendererContribution | WebviewContribution>;
  sessionAnchorRenderers?: Record<string, RendererContribution | WebviewContribution>;

  commands?: Record<string, CommandDefinition<any, any>>;
  middlewares?: Record<string, MiddlewareDefinition<any, any>>;
  hooks?: Record<string, HookDefinition<any>>;
  schedules?: Record<string, ScheduleContribution<any>>;

  artifactMounts?: Record<string, ArtifactMountContribution>;
  templateTypes?: Record<string, TemplateTypeContribution>;
  templates?: Record<string, TemplateContribution>;
  skills?: Record<string, SkillContribution>;

  workspaceTypes?: Record<string, WorkspaceTypeProvider>;
  harnesses?: Record<string, HarnessProvider>;

  initialSetup?: (ctx: SetupContext) => MaybePromise<void>;
  migrate?: (ctx: MigrationContext, fromVersion: string | null) => MaybePromise<void>;
}

export declare function defineExtension<const TExtension extends ExtensionDefinition>(
  extension: TExtension,
): TExtension;

// ---------------------------------------------------------------------------
// Generic kernel-owned slots and events
// ---------------------------------------------------------------------------

export declare const projectSlots: {
  sidebarNav: SlotRef<Struct, "navigation">;
  headerPrimary: SlotRef<Struct, "menu">;
  headerOverflow: SlotRef<Struct, "menu">;
  settingsPanels: SlotRef<Struct, "settings">;
};

export declare const sessionSlots: {
  headerPrimary: SlotRef<Struct, "menu">;
  headerOverflow: SlotRef<Struct, "menu">;
  transcriptActions: SlotRef<Struct, "menu">;
};

export declare const projectEvents: {
  opened: EventRef<{ projectId: string }>;
};

export declare const sessionEvents: {
  started: EventRef<{ sessionId: string; anchors?: ResourceAnchor[] }>;
  completed: EventRef<{ sessionId: string; anchors?: ResourceAnchor[] }>;
};

export declare const workspaceEvents: {
  created: EventRef<{ workspace: JsonObject }>;
  archived: EventRef<{ workspace: JsonObject }>;
  deleted: EventRef<{ workspace: JsonObject }>;
};
