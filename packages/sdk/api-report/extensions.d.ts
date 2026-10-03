import { z } from "zod";
declare const agentModelSchema: z.ZodObject<{
  id: z.ZodString;
  label: z.ZodOptional<z.ZodString>;
  description: z.ZodOptional<z.ZodString>;
  isDefault: z.ZodOptional<z.ZodBoolean>;
  paramOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodObject<{
    label: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
    description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
    required: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    type: z.ZodLiteral<"select">;
    defaultValue: z.ZodOptional<z.ZodString>;
    options: z.ZodArray<z.ZodObject<{
      label: z.ZodString;
      value: z.ZodString;
      icon: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
  }, z.core.$strip>, z.ZodObject<{
    label: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
    description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
    required: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    type: z.ZodLiteral<"boolean">;
    defaultValue: z.ZodOptional<z.ZodBoolean>;
  }, z.core.$strip>]>>>>;
}, z.core.$strip>;
type AgentModel = z.infer<typeof agentModelSchema>;
declare const automationRunStatusSchema: z.ZodEnum<{
  failed: "failed";
  running: "running";
  queued: "queued";
  cancelled: "cancelled";
  succeeded: "succeeded";
  rejected: "rejected";
}>;
declare const createAutomationRunInputSchema: z.ZodObject<{
  commandId: z.ZodString;
  input: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    resource: z.ZodOptional<z.ZodObject<{
      shorthand: z.ZodOptional<z.ZodString>;
      type: z.ZodString;
      id: z.ZodString;
      projectId: z.ZodOptional<z.ZodString>;
      label: z.ZodOptional<z.ZodString>;
      icon: z.ZodOptional<z.ZodString>;
      extensionId: z.ZodOptional<z.ZodString>;
      metadata: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
    }, z.core.$strip>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  }, z.core.$strict>;
}, z.core.$strict>;
declare const automationRunSchema: z.ZodObject<{
  id: z.ZodString;
  projectId: z.ZodString;
  commandId: z.ZodString;
  status: z.ZodEnum<{
    failed: "failed";
    running: "running";
    queued: "queued";
    cancelled: "cancelled";
    succeeded: "succeeded";
    rejected: "rejected";
  }>;
  createdAt: z.ZodString;
  startedAt: z.ZodNullable<z.ZodString>;
  finishedAt: z.ZodNullable<z.ZodString>;
  result: z.ZodNullable<z.ZodUnknown>;
  error: z.ZodNullable<z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    retryable: z.ZodBoolean;
  }, z.core.$strip>>;
}, z.core.$strip>;
type AutomationRunStatus = z.infer<typeof automationRunStatusSchema>;
type CreateAutomationRunInput = z.infer<typeof createAutomationRunInputSchema>;
type AutomationRun = z.infer<typeof automationRunSchema>;
declare const parseExtensionApiDeclaration: (declaration: string) => string[] | null;
declare const supportsExtensionApiVersion: (declaration: string, hostVersion: string) => boolean;
type ViewFilterCondition = "contains" | "does-not-contain" | "is" | "is-not" | "gt" | "gte" | "lt" | "lte" | "is-before" | "is-after" | "is-on-or-before" | "is-on-or-after" | "is-any-of" | "is-none-of" | "has-any-of" | "has-all-of" | "has-none-of" | "is-empty" | "is-not-empty";
type ViewFilterRule = {
  attributeId: string;
  condition: ViewFilterCondition;
  value?: boolean | string | number | string[];
};
type ViewFilterGroup = {
  conjunction: "and" | "or";
  rules: ViewFilterRule[];
};
type ViewSortDirection = "asc" | "desc";
type ViewSort = {
  attributeId: string;
  direction: ViewSortDirection;
};
type ViewFieldKind = "string" | "number" | "boolean" | "date" | "enum" | "status" | "enum-multi" | "user";
export declare const VIEW_FILTER_CONDITIONS: Record<ViewFieldKind, readonly ViewFilterCondition[]>;
export declare const normalizeBooleanViewRule: (rule: ViewFilterRule, type: {
  kind: string;
  legacyValues?: Record<string, boolean>;
}) => ViewFilterRule;
interface LocalizedString {
  readonly $l10n: string;
  readonly default?: string;
}
type Localizable<T extends string = string> = T | LocalizedString;
export declare const l10n: (key: string, defaultValue?: string) => {
  default?: string | undefined;
  $l10n: string;
};
export declare const isLocalizedString: (value: unknown) => value is LocalizedString;
declare const workbenchMenuTargets: readonly ["workbench.nav.actions", "workbench.nav.overflow"];
declare const workbenchTreeTargets: readonly ["workbench.left.tree", "workbench.main.left.tree", "workbench.main.right.tree"];
declare const workbenchViewTargets: readonly ["workbench.main", "workbench.main.left", "workbench.main.right", "workbench.secondary"];
declare const workbenchSettingsTargets: readonly ["workbench.settings"];
type WorkbenchMenuTarget = (typeof workbenchMenuTargets)[number];
type WorkbenchTreeTarget = (typeof workbenchTreeTargets)[number];
type WorkbenchViewTarget = (typeof workbenchViewTargets)[number];
type WorkbenchSettingsTarget = (typeof workbenchSettingsTargets)[number];
type WorkbenchAttachmentTarget = WorkbenchMenuTarget | WorkbenchTreeTarget | WorkbenchViewTarget | WorkbenchSettingsTarget;
type ContributionKind = "activity-item" | "artifact-mount" | "command" | "command-palette-resource" | "connection" | "file-icon-theme" | "harness" | "hook" | "keybinding" | "middleware" | "mode" | "navigation-item" | "navigation-tree" | "page" | "placement" | "resource-hierarchy-provider" | "resource-kind" | "schedule" | "settings-panel" | "settings-section" | "skill" | "status" | "status-bar-item" | "template" | "template-type" | "theme" | "view" | "view-menu" | "workspace-type";
interface ContributionRef<Kind extends ContributionKind> {
  readonly extensionId?: string;
  readonly kind: Kind;
  readonly id: string;
}
interface ContributionDefinition<Kind extends ContributionKind> {
  readonly id: string;
  readonly ref: ContributionRef<Kind>;
}
type ContributionInput<Kind extends ContributionKind> = Omit<ContributionDefinition<Kind>, "ref">;
type ConnectionRef = ContributionRef<"connection">;
type ThemeRef = ContributionRef<"theme">;
type ModeRef = ContributionRef<"mode">;
type PageRef = ContributionRef<"page">;
type PlacementRef = ContributionRef<"placement">;
type ResourceKindRef = ContributionRef<"resource-kind">;
type SettingsSectionRef = ContributionRef<"settings-section">;
interface SettingsSlotRef {
  readonly id: string;
}
interface StatusBarSlotRef {
  readonly id: string;
}
type StatusRef = ContributionRef<"status">;
type ViewRef = ContributionRef<"view">;
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
type JsonObject = {
  [key: string]: JsonValue;
};
type MaybePromise<T> = T | Promise<T>;
type Struct = object;
interface TerminalSessionRequest {
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols: number;
  rows: number;
}
type TerminalEvent = {
  kind: "data";
  chunk: Uint8Array;
} | {
  kind: "title";
  title: string;
} | {
  kind: "exit";
  code: number | null;
  signal: string | null;
} | {
  kind: "error";
  message: string;
};
interface TerminalSessionHandle {
  readonly id: string;
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): Promise<void>;
  events(): AsyncIterable<TerminalEvent>;
}
type TerminalSessionOperation = {
  operation: "open";
  request: TerminalSessionRequest;
} | {
  operation: "write";
  sessionId: string;
  data: string | Uint8Array;
} | {
  operation: "resize";
  sessionId: string;
  cols: number;
  rows: number;
} | {
  operation: "kill";
  sessionId: string;
  signal?: string;
} | {
  operation: "subscribe";
  sessionId: string;
};
type TerminalSessionResult = {
  operation: "open";
  sessionId: string;
} | {
  operation: "write" | "resize" | "kill" | "subscribe";
  accepted: true;
};
type ResourceRole = "primary" | "context" | "source" | "result";
interface ResourceRef {
  type: string;
  id: string;
  shorthand?: string;
  projectId?: string;
  label?: string;
  icon?: string;
  extensionId?: string;
  metadata?: JsonObject;
}
interface ResourceRemovedEvent {
  id: string;
  resource: ResourceRef;
}
interface ExtensionResourcesApi {
  removed(resource: ResourceRef): Promise<void>;
  allocate(input: {
    kind: string;
  }): Promise<{
    id: string;
    shorthand: string;
  }>;
}
interface ViewHierarchyParent {
  type: "view";
  viewId: string;
}
interface RendererInvocationContext {
  placement: "visible" | "background";
}
interface RendererContext {
  rendererId: string;
  projectId?: string;
  modeId?: string;
  resource?: ResourceRef;
  invocation?: RendererInvocationContext;
}
interface ResourceAnchor extends ResourceRef {
  role?: ResourceRole;
}
interface PackageAssetDescriptor {
  kind: "package-asset";
  path: string;
  baseUrl: string;
}
type NotificationKind = "needs_review" | "ready_to_merge" | "blocked" | "approval_required" | "failed" | "info";
type NotificationStatus = "open" | "read" | "snoozed" | "done" | "dismissed" | "expired";
type NotificationPriority = "low" | "normal" | "high" | "urgent";
type NotificationActorType = "user" | "agent" | "system";
type NotificationOrigin = "core" | "extension" | "agent";
type NotificationAction = {
  id: string;
  label: string;
  kind: "navigate";
  target: NavigationTarget;
  primary?: boolean;
} | {
  id: string;
  label: string;
  kind: "command";
  command: string;
  params?: JsonObject;
  primary?: boolean;
  destructive?: boolean;
} | {
  id: string;
  label: string;
  kind: "url";
  href: string;
  primary?: boolean;
};
interface Notification {
  id: string;
  projectId: string;
  title: string;
  body?: string | null;
  kind: NotificationKind;
  status: NotificationStatus;
  priority: NotificationPriority;
  source: CommandSource;
  origin: NotificationOrigin;
  sourceExtensionId?: string | null;
  actorType?: NotificationActorType | null;
  actorId?: string | null;
  target?: ResourceRef | null;
  related: ResourceRef[];
  actions: NotificationAction[];
  dedupeKey?: string | null;
  metadata?: JsonObject | null;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null;
  resolvedAt?: string | null;
  snoozedUntil?: string | null;
  expiresAt?: string | null;
}
interface CreateNotificationInput {
  projectId: string;
  title: string;
  body?: string;
  kind: NotificationKind;
  priority?: NotificationPriority;
  target?: ResourceRef;
  related?: ResourceRef[];
  actions?: NotificationAction[];
  dedupeKey?: string;
  expiresAt?: string;
  snoozedUntil?: string;
  metadata?: JsonObject;
}
interface UpdateNotificationInput {
  priority?: NotificationPriority;
  snoozedUntil?: string | null;
  metadata?: JsonObject;
}
interface ListNotificationsQuery {
  status?: NotificationStatus | NotificationStatus[];
  priority?: NotificationPriority | NotificationPriority[];
  sourceExtensionId?: string;
  resourceType?: string;
  resourceId?: string;
  cursor?: string;
  limit?: number;
}
interface ListNotificationsResponse {
  items: Notification[];
  nextCursor?: string | null;
}
declare const sessionStatusSchema: z.ZodEnum<{
  failed: "failed";
  completed: "completed";
  in_progress: "in_progress";
  awaiting_input: "awaiting_input";
  queued: "queued";
  cancelled: "cancelled";
  disconnected: "disconnected";
}>;
declare const sessionAttachmentRefSchema: z.ZodObject<{
  file_id: z.ZodString;
}, z.core.$strip>;
type SessionStatus = z.infer<typeof sessionStatusSchema>;
type SessionAttachmentRef = z.infer<typeof sessionAttachmentRefSchema>;
declare const skillSchema: z.ZodObject<{
  id: z.ZodString;
  project_id: z.ZodString;
  name: z.ZodString;
  title: z.ZodString;
  description: z.ZodString;
  source_kind: z.ZodEnum<{
    project: "project";
    extension: "extension";
  }>;
  files: z.ZodArray<z.ZodObject<{
    path: z.ZodString;
    content: z.ZodString;
    encoding: z.ZodLiteral<"utf8">;
  }, z.core.$strip>>;
  editable: z.ZodBoolean;
  extension_instance_id: z.ZodOptional<z.ZodString>;
  extension_id: z.ZodOptional<z.ZodString>;
  installed_extension_id: z.ZodOptional<z.ZodString>;
  install_name: z.ZodOptional<z.ZodString>;
  key: z.ZodOptional<z.ZodString>;
  source: z.ZodOptional<z.ZodObject<{
    kind: z.ZodLiteral<"package-asset">;
    path: z.ZodString;
    baseUrl: z.ZodString;
  }, z.core.$strip>>;
  enabled: z.ZodOptional<z.ZodBoolean>;
  created_at: z.ZodString;
  updated_at: z.ZodString;
  deleted_at: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
type Skill = z.infer<typeof skillSchema>;
interface ExtensionAutomationApi {
  enqueue(input: {
    command: CommandRef | string;
    input: CreateAutomationRunInput["input"];
    key: string;
  }): Promise<AutomationRun>;
  get(runId: string): Promise<AutomationRun | undefined>;
  list(filter?: {
    status?: AutomationRunStatus[];
  }): Promise<AutomationRun[]>;
  cancel(runId: string): Promise<AutomationRun>;
}
type ExtensionConnectionMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface ExtensionConnectionRequest {
  method: ExtensionConnectionMethod;
  path: string;
  headers?: Record<string, string>;
  body?: JsonValue;
  timeoutMs?: number;
  signal?: AbortSignal;
}
interface ExtensionConnectionResponse<TBody = JsonValue> {
  status: number;
  headers: Record<string, string>;
  body: TBody;
}
type ExtensionConnectionStreamEvent = {
  type: "response";
  status: number;
  headers: Record<string, string>;
} | {
  type: "data";
  data: Uint8Array;
} | {
  type: "end";
};
interface ExtensionConnectionsApi {
  request<TBody = JsonValue>(connectionId: string, input: ExtensionConnectionRequest): Promise<ExtensionConnectionResponse<TBody>>;
  stream(connectionId: string, input: ExtensionConnectionRequest): AsyncIterable<ExtensionConnectionStreamEvent>;
}
interface ExtensionLoggerApi {
  info(message: string, metadata?: JsonObject): void;
  warn(message: string, metadata?: JsonObject): void;
  error(message: string, metadata?: JsonObject): void;
}
interface EventRef<TPayload extends Struct = Struct> {
  readonly extensionId?: string;
  readonly kind: "event";
  readonly id: string;
  payload?: TPayload;
}
interface EventDeliveryResult {
  delivered: number;
  diagnostics?: CommandDiagnostic[];
}
type UiSlotKind = "menu" | "panel" | "settings" | "renderer" | "kanbanRenderer" | "dataTableRenderer";
interface SlotOptions<TKind extends UiSlotKind = UiSlotKind> {
  kind: TKind;
  label?: string;
  description?: string;
  metadata?: JsonObject;
}
interface SlotRef<TContext extends Struct = Struct, TKind extends UiSlotKind = UiSlotKind> {
  id: string;
  kind: TKind;
  label?: string;
  description?: string;
  metadata?: JsonObject;
  context?: TContext;
}
interface SlotInvocationContext<TContext extends Struct = Struct> {
  id: string;
  kind: UiSlotKind;
  context: TContext;
}
type ParamType = "text" | "longtext" | "markdown" | "number" | "boolean" | "select" | "multi-select" | "files" | "harness" | "template" | "resource" | "workspace" | "json" | "list";
type ParamRequired<TRequired extends boolean | undefined> = TRequired extends true ? {
  required: true;
} : TRequired extends false ? {
  required: false;
} : {
  required?: boolean;
};
type ParamBase<TValue, TRequired extends boolean | undefined = boolean | undefined> = {
  label?: Localizable<string>;
  description?: Localizable<string>;
  defaultValue?: TValue;
  metadata?: JsonObject;
  resolvedFrom?: "resource";
} & ParamRequired<TRequired>;
type TextParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string, TRequired> & {
  type: "text";
};
type LongTextParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string, TRequired> & {
  type: "longtext";
};
type MarkdownParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string, TRequired> & {
  type: "markdown";
  placeholder?: Localizable<string>;
};
type NumberParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<number, TRequired> & {
  type: "number";
};
type FilesParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string[], TRequired> & {
  type: "files";
  multiple?: boolean;
  accept?: string;
};
type BooleanParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<boolean, TRequired> & {
  type: "boolean";
};
type ParamValueRef = {
  kind: "param-value";
  key: string;
};
interface ParamOptionSource {
  command: CommandRef;
  valueField: string;
  labelField: string;
  params?: Record<string, unknown | ParamValueRef>;
}
type ParamOption = {
  label: string;
  value: string;
  icon?: string;
};
type SelectParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string, TRequired> & {
  type: "select";
  options: ParamOption[] | ParamOptionSource;
  allowCustomValues?: boolean;
};
type MultiSelectParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string[], TRequired> & {
  type: "multi-select";
  options: ParamOption[] | ParamOptionSource;
  allowCustomValues?: boolean;
};
type HarnessParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<{
  harnessId: string;
  model?: string;
  params?: Record<string, string | boolean>;
}, TRequired> & {
  type: "harness";
};
type TemplateParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string, TRequired> & {
  type: "template";
  templateType: string;
};
type ResourceParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<ResourceRef, TRequired> & {
  type: "resource";
  resourceType: string;
};
type WorkspaceParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<{
  providerId: string;
  params?: JsonObject;
}, TRequired> & {
  type: "workspace";
  providers?: string[];
};
type JsonParam<T = unknown, TRequired extends boolean | undefined = boolean | undefined> = ParamBase<T, TRequired> & {
  type: "json";
};
type ListParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string[], TRequired> & {
  type: "list";
};
type ParamDescriptor<TValue = unknown, TRequired extends boolean | undefined = boolean | undefined> = TextParam<TRequired> | LongTextParam<TRequired> | MarkdownParam<TRequired> | NumberParam<TRequired> | BooleanParam<TRequired> | SelectParam<TRequired> | MultiSelectParam<TRequired> | FilesParam<TRequired> | HarnessParam<TRequired> | TemplateParam<TRequired> | ResourceParam<TRequired> | WorkspaceParam<TRequired> | JsonParam<TValue, TRequired> | ListParam<TRequired>;
type ParamObjectSchema = Record<string, ParamDescriptor>;
type ParamValue<TDescriptor extends ParamDescriptor> = TDescriptor extends ParamDescriptor<infer V> ? V : never;
type RequiredParamKeys<TSchema extends ParamObjectSchema> = { [K in keyof TSchema]: TSchema[K] extends {
  required: true;
} ? K : never; }[keyof TSchema];
type OptionalParamKeys<TSchema extends ParamObjectSchema> = Exclude<keyof TSchema, RequiredParamKeys<TSchema>>;
type ParamsOf<TSchema extends ParamObjectSchema> = { [K in RequiredParamKeys<TSchema>]: ParamValue<TSchema[K]>; } & { [K in OptionalParamKeys<TSchema>]?: ParamValue<TSchema[K]>; };
type RendererEventReference = EventRef | `${string}.${string}`;
interface RendererContributionBase {
  title: Localizable<string>;
  icon?: string;
  resourceKind?: string;
  refreshEvents?: readonly RendererEventReference[];
  emptyTitle?: Localizable<string>;
  emptyDescription?: Localizable<string>;
}
export declare const WEBVIEW_HOST_CAPABILITY_VERSION = 1;
export declare const WEBVIEW_DECLARABLE_CAPABILITIES: readonly ["clipboard.write", "commands.execute", "navigation.open", "placement.close", "notification.show", "notification.action", "notification.resolve", "notification.dismiss", "preferences.get", "preferences.set", "extension.settings.all", "extension.settings.get", "extension.settings.set", "extension.settings.delete", "terminal.session", "files.upload", "files.list", "files.delete"];
export declare const WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES: readonly ["artifacts.read"];
export declare const ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES: readonly ["host.dispatchKeyboardEvent"];
export declare const WEBVIEW_HOST_CAPABILITIES: readonly [...("commands.execute" | "navigation.open" | "placement.close" | "notification.show" | "notification.action" | "notification.resolve" | "notification.dismiss" | "preferences.get" | "preferences.set" | "extension.settings.all" | "extension.settings.get" | "extension.settings.set" | "extension.settings.delete" | "terminal.session" | "files.upload" | "files.list" | "files.delete")[], "artifacts.read", "host.dispatchKeyboardEvent"];
type WebviewHostCapability = (typeof WEBVIEW_HOST_CAPABILITIES)[number];
type WebviewDeclarableCapability = (typeof WEBVIEW_DECLARABLE_CAPABILITIES)[number];
type WebviewScopedDeclarableCapability = (typeof WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES)[number];
type WebviewCapabilityDeclaration = WebviewDeclarableCapability | `${WebviewDeclarableCapability}@${typeof WEBVIEW_HOST_CAPABILITY_VERSION}` | `${WebviewScopedDeclarableCapability}:${string}`;
interface WebviewCommandsExecuteParams {
  commandId: string;
  params?: JsonObject;
  workspaceId?: string;
  resource?: ResourceRef;
  metadata?: JsonObject;
}
interface WebviewNavigationOpenParams {
  target: NavigationTarget;
}
interface WebviewNotificationShowParams {
  level: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
}
type WebviewNotificationActionParams = Omit<CreateNotificationInput, "projectId">;
interface WebviewNotificationResolveParams {
  id?: string;
  dedupeKey?: string;
  status?: Extract<NotificationStatus, "done" | "dismissed" | "expired">;
}
type WebviewNotificationDismissParams = Pick<WebviewNotificationResolveParams, "id" | "dedupeKey">;
interface WebviewPreferencesGetParams {
  name: string;
  scope?: {
    scope: "default" | "user" | "project" | "workspace" | "extension" | "session";
    scopeId?: string;
  };
}
interface WebviewPreferencesSetParams extends WebviewPreferencesGetParams {
  value: boolean | number | string | string[] | number[] | boolean[] | Record<string, unknown>;
}
interface WebviewExtensionSettingKeyParams {
  key: string;
}
interface WebviewExtensionSettingSetParams extends WebviewExtensionSettingKeyParams {
  value: unknown;
}
type WebviewFileScope = {
  type: "project";
} | {
  type: "resource";
  id: string;
} | {
  type: string;
  id?: string;
};
interface WebviewFilesUploadParams {
  name: string;
  data: Uint8Array | ArrayBuffer;
  mimeType?: string;
  scope?: WebviewFileScope;
}
interface WebviewFilesListParams {
  scope?: WebviewFileScope;
}
interface WebviewFilesDeleteParams {
  id: string;
}
type WebviewArtifactsReadParams = {
  op: "list";
  mount: string;
  prefix?: string;
} | {
  op: "readText";
  mount: string;
  path: string;
} | {
  op: "imageUrl";
  mount: string;
  path: string;
};
interface WebviewArtifactFile {
  path: string;
  size: number;
  mediaType: string;
}
interface WebviewKeyboardEventParams {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
}
interface WebviewHostCapabilityParams {
  "commands.execute": WebviewCommandsExecuteParams;
  "navigation.open": WebviewNavigationOpenParams;
  "placement.close": Record<string, never>;
  "notification.show": WebviewNotificationShowParams;
  "notification.action": WebviewNotificationActionParams;
  "notification.resolve": WebviewNotificationResolveParams;
  "notification.dismiss": WebviewNotificationDismissParams;
  "preferences.get": WebviewPreferencesGetParams;
  "preferences.set": WebviewPreferencesSetParams;
  "extension.settings.all": Record<string, never>;
  "extension.settings.get": WebviewExtensionSettingKeyParams;
  "extension.settings.set": WebviewExtensionSettingSetParams;
  "extension.settings.delete": WebviewExtensionSettingKeyParams;
  "terminal.session": TerminalSessionOperation;
  "files.upload": WebviewFilesUploadParams;
  "files.list": WebviewFilesListParams;
  "files.delete": WebviewFilesDeleteParams;
  "artifacts.read": WebviewArtifactsReadParams;
  "host.dispatchKeyboardEvent": WebviewKeyboardEventParams;
}
interface WebviewHostCapabilityResults {
  "commands.execute": {
    outcome: CommandOutcome;
  };
  "navigation.open": void;
  "placement.close": void;
  "notification.show": void;
  "notification.action": Notification;
  "notification.resolve": Notification | {
    resolved: number;
    notifications: Notification[];
  };
  "notification.dismiss": Notification | {
    resolved: number;
    notifications: Notification[];
  };
  "preferences.get": WebviewPreferencesSetParams["value"] | undefined;
  "preferences.set": {
    name: string;
    value: WebviewPreferencesSetParams["value"];
  };
  "extension.settings.all": Record<string, unknown>;
  "extension.settings.get": unknown;
  "extension.settings.set": void;
  "extension.settings.delete": void;
  "terminal.session": TerminalSessionResult;
  "files.upload": ExtensionBlobRef;
  "files.list": {
    files: ExtensionBlobRef[];
  };
  "files.delete": void;
  "artifacts.read": WebviewArtifactFile[] | string;
  "host.dispatchKeyboardEvent": void;
}
type WebviewHostCapabilityResult<Capability extends WebviewHostCapability, Params extends WebviewHostCapabilityParams[Capability] = WebviewHostCapabilityParams[Capability]> = Capability extends "artifacts.read" ? Params extends {
  op: "list";
} ? WebviewArtifactFile[] : Params extends {
  op: "readText" | "imageUrl";
} ? string : WebviewHostCapabilityResults[Capability] : Capability extends "terminal.session" ? Params extends {
  operation: "open";
} ? Extract<TerminalSessionResult, {
  operation: "open";
}> : Params extends {
  operation: "write" | "resize" | "kill" | "subscribe";
} ? Exclude<TerminalSessionResult, {
  operation: "open";
}> : TerminalSessionResult : WebviewHostCapabilityResults[Capability];
interface ViewToolbarAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  presentation?: "primary" | "secondary";
  command: CommandRef<TParams, unknown>;
  params?: Record<string, unknown>;
  input?: ParamObjectSchema;
  submitLabel?: string;
  when?: string;
  disabled?: boolean;
}
type KanbanRendererViewMode = "board" | "list";
type KanbanRendererSortDirection = "asc" | "desc";
interface KanbanRendererEnumOption {
  value: string;
  label: Localizable<string>;
  color?: string;
  icon?: string | null;
}
type KanbanRendererAttributeType = {
  kind: "enum";
  options: KanbanRendererEnumOption[];
} | {
  kind: "enum-multi";
  options: KanbanRendererEnumOption[];
} | {
  kind: "status";
  statuses: StatusRef;
} |
{
  kind: "boolean";
  legacyValues?: Record<string, boolean>;
} | {
  kind: "string";
} | {
  kind: "date";
} | {
  kind: "number";
} | {
  kind: "user";
};
interface CollectionBadgeItem {
  id: string;
  label: string;
  icon?: string;
  resource?: ResourceRef;
}
type KanbanRendererAttributeDisplay = {
  kind: "badge-list";
  itemsAttributeId: string;
};
interface KanbanRendererAttributeDescriptor {
  id: string;
  label: Localizable<string>;
  type: KanbanRendererAttributeType;
  filterable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  displayable?: boolean;
  editable?: boolean;
  display?: KanbanRendererAttributeDisplay;
}
interface KanbanRendererSettings {
  viewMode: KanbanRendererViewMode;
  columnGrouping: string;
  rowGrouping: string;
  /** @deprecated */
  ordering: {
    attributeId: string;
    direction: KanbanRendererSortDirection;
  };
  displayProperties: string[];
}
type KanbanRendererViewSettings = Omit<KanbanRendererSettings, "ordering"> & {
  /** @deprecated */
  ordering?: KanbanRendererSettings["ordering"];
};
/** @deprecated */
type KanbanRendererFilterState = Record<string, string[]>;
interface KanbanRendererSavedView {
  id: string;
  title: Localizable<string>;
  settings: KanbanRendererViewSettings;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
  /** @deprecated */
  filters?: KanbanRendererFilterState;
  /** @deprecated */
  isDefault?: boolean;
}
interface KanbanRendererQueryParams {
  renderer: RendererContext;
  settings: KanbanRendererSettings;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
  /** @deprecated */
  filters: KanbanRendererFilterState;
}
type KanbanRendererResourceRef = ResourceRef;
interface KanbanRendererRow {
  id: string;
  title: string;
  resource?: KanbanRendererResourceRef;
  attributes: Record<string, unknown>;
}
interface KanbanRendererColumnAction {
  id: string;
  label: Localizable<string>;
  icon?: string;
}
interface KanbanRendererBoardColumnConfig {
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: KanbanRendererColumnAction[];
}
interface KanbanRendererQueryResult {
  rows: KanbanRendererRow[];
  attributes?: KanbanRendererAttributeDescriptor[];
  boardColumnConfigs?: Record<string, KanbanRendererBoardColumnConfig>;
}
interface KanbanRendererCreateRowContribution<TParams extends ParamObjectSchema = ParamObjectSchema> {
  command: CommandRef<Struct, unknown>;
  title?: Localizable<string>;
  submitLabel?: Localizable<string>;
  columnParam?: string;
  params?: TParams;
  attributesParam?: string;
  attachments?: {
    command: CommandRef<Struct, unknown>;
    resourceParam: string;
    fileParam: string;
  };
  labels?: {
    cancel?: Localizable<string>;
    properties?: Localizable<string>;
    submitError?: Localizable<string>;
    removeFile?: Localizable<string>;
  };
}
interface KanbanRendererRowAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  command: CommandRef<TParams, unknown>;
  destructive?: boolean;
}
type KanbanRendererRowActivationHandler = RendererCallback<{
  row: KanbanRendererRow;
}, void>;
interface KanbanRendererContribution extends RendererContributionBase {
  toolbarActions?: ViewToolbarAction[];
  attributes?: KanbanRendererAttributeDescriptor[];
  query: RendererCallback<KanbanRendererQueryParams, KanbanRendererQueryResult>;
  onAttributeChange?: RendererCallback<{
    rowId: string;
    attributeId: string;
    value: unknown;
  }, unknown>;
  onReorder?: RendererCallback<{
    rowId: string;
    beforeRowId?: string;
  }, unknown>;
  onColumnAction?: RendererCallback<{
    columnId: string;
    actionId: string;
  }, unknown>;
  createRow?: KanbanRendererCreateRowContribution;
  rowActions?: KanbanRendererRowAction[];
  onRowActivate?: KanbanRendererRowActivationHandler;
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilter?: ViewFilterGroup;
  defaultSorts?: ViewSort[];
  /** @deprecated */
  defaultFilters?: KanbanRendererFilterState;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  hideToolbar?: boolean;
}
interface CliContribution {
  path?: string[];
  globalAliases?: string[][];
  description?: Localizable<string>;
  examples?: string[];
  hidden?: boolean;
}
interface WhenExpression {
  mode?: ModeRef | readonly ModeRef[];
  source?: CommandSource[];
  view?: ViewRef | readonly ViewRef[];
  resourceType?: readonly ResourceKindRef[];
  metadata?: JsonObject;
}
interface MenuContribution<TSlotContext extends Struct = Struct, TParams extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "menu">;
  label?: Localizable<string>;
  group?: string;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  params?: Partial<TParams>;
  presentation?: "menu-item" | "button" | "icon-button";
}
interface CommandPaletteContribution<TParams extends Struct = Struct> {
  label?: Localizable<string>;
  group?: string;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  params?: Partial<TParams>;
}
interface ActivityItemContribution<TParams extends Struct = Struct> extends ContributionDefinition<"activity-item"> {
  title: Localizable<string>;
  icon: string;
  modes: readonly ModeRef[];
  placement?: "first" | "default" | "last";
  command: CommandRef<TParams, unknown>;
  params?: Partial<TParams>;
}
interface ModeRegionSettings {
  readonly showHeader?: boolean;
  readonly size?: RegionSize;
  readonly collapsible?: boolean;
  readonly alwaysShowTabs?: boolean;
}
interface ModeContribution extends ContributionDefinition<"mode"> {
  label: Localizable<string>;
  icon?: string;
  regions: readonly ExtensionPanelRegion[];
  defaultTheme?: ThemeRef;
  floatingPanels?: "visible" | "hidden";
  chrome?: Partial<Record<"nav" | "sidenav" | "activity" | "status", ViewRef | false>>;
  regionSettings?: Readonly<Partial<Record<DockedWorkbenchRegion, ModeRegionSettings>>>;
}
interface WebviewContribution {
  entry: PackageAssetDescriptor;
  title?: Localizable<string>;
  capabilities?: WebviewCapabilityDeclaration[];
}
interface SettingsPanelContribution extends ContributionDefinition<"settings-panel"> {
  view: ViewRef;
  slot: SettingsSlotRef;
  section?: SettingsSectionRef;
}
interface SettingsSectionContribution extends ContributionDefinition<"settings-section"> {
  title: Localizable<string>;
  order?: number;
}
interface CommandPaletteResourceQueryParams {
  projectId?: string;
  modeId?: string;
  activeResource?: ResourceRef;
  providerId: string;
  query: string;
  limit: number;
}
type CommandPaletteResourceTarget = NavigationTarget;
interface CommandPaletteResourceItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  keywords?: string[];
  target: CommandPaletteResourceTarget;
}
interface CommandPaletteResourceQueryResult {
  items: CommandPaletteResourceItem[];
}
interface CommandPaletteResourceContribution extends ContributionDefinition<"command-palette-resource"> {
  title: Localizable<string>;
  resourceKind?: ResourceKindRef;
  query: RendererCallback<CommandPaletteResourceQueryParams, CommandPaletteResourceQueryResult>;
  refreshEvents?: readonly RendererEventReference[];
}
type ExtensionSettingScope = "global" | "project";
type ExtensionSettingValueType = "boolean" | "number" | "string" | "array" | "object";
type ExtensionSettingValueForType<TType extends ExtensionSettingValueType> = TType extends "boolean" ? boolean : TType extends "number" ? number : TType extends "string" ? string : TType extends "array" ? JsonValue[] : JsonObject;
type ExtensionSettingProperty<TType extends ExtensionSettingValueType = ExtensionSettingValueType> = { [TSettingType in TType]: {
  type: TSettingType;
  scope: ExtensionSettingScope;
  default?: ExtensionSettingValueForType<TSettingType>;
  enum?: ExtensionSettingValueForType<TSettingType>[];
  options?: TSettingType extends "string" ? ParamOptionSource : never;
  title?: Localizable<string>;
  description?: Localizable<string>;
}; }[TType];
interface ExtensionSettingsContribution<TProperties extends Record<string, ExtensionSettingProperty> = Record<string, ExtensionSettingProperty>> {
  properties: TProperties;
}
interface ArtifactMountContribution extends ContributionDefinition<"artifact-mount"> {
  path: string;
  label: Localizable<string>;
}
interface TemplateTypeContribution extends ContributionDefinition<"template-type"> {
  label: Localizable<string>;
  description?: Localizable<string>;
  order?: number;
  commands?: {
    list: CommandRef;
    read: CommandRef;
    save: CommandRef;
    delete: CommandRef;
  };
}
interface TemplateContribution extends ContributionDefinition<"template"> {
  title: Localizable<string>;
  type: string;
  source: PackageAssetDescriptor;
  description?: Localizable<string>;
}
interface SkillContribution extends ContributionDefinition<"skill"> {
  title: Localizable<string>;
  source: PackageAssetDescriptor;
  description?: Localizable<string>;
}
type ThemeMode = "light" | "dark";
interface ThemeContribution extends ContributionDefinition<"theme"> {
  title: Localizable<string>;
  source: PackageAssetDescriptor;
  format: "vscode-color-theme";
  mode?: ThemeMode;
  description?: Localizable<string>;
}
interface FileIconThemeContribution extends ContributionDefinition<"file-icon-theme"> {
  title: Localizable<string>;
  source: PackageAssetDescriptor;
  format: "vscode-file-icon-theme";
  description?: Localizable<string>;
}
type KeybindingChord = string;
interface KeybindingContribution extends ContributionDefinition<"keybinding"> {
  key: KeybindingChord;
  mac?: KeybindingChord;
  linux?: KeybindingChord;
  win?: KeybindingChord;
  action: NavigationTarget;
  when?: WhenExpression;
}
type SessionMessageRole = "user" | "assistant" | "tool" | "system" | "developer";
type TextPart = {
  type: "text";
  text: string;
};
type ReasoningPart = {
  type: "reasoning";
  text: string;
};
type ToolPartActionType = "read" | "write" | "execute" | "network" | "other";
type ToolPartStatus = "pending" | "running" | "completed" | "failed" | "denied";
type ToolPart = {
  type: "tool";
  tool: string;
  callId?: string;
  actionType?: ToolPartActionType;
  status?: ToolPartStatus;
  state?: {
    status?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
    metadata?: unknown;
  };
};
type StepStartPart = {
  type: "step-start";
  snapshot?: string;
};
type StepFinishPart = {
  type: "step-finish";
  reason?: string;
  snapshot?: string;
  cost?: number;
  tokens?: unknown;
};
type PatchPart = {
  type: "patch";
  hash?: string;
  files?: unknown;
};
type FilePart = {
  type: "file";
  fileId?: string;
  mediaType?: string;
  filename?: string;
  size?: number;
  url: string;
};
type LoadingPart = {
  type: "loading";
};
type ErrorPart = {
  type: "error";
  errorType: "timeout" | "crash" | "permission" | "other";
  message?: string;
};
type TokenUsagePart = {
  type: "token_usage";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};
type SessionMessagePart = TextPart | ReasoningPart | ToolPart | StepStartPart | StepFinishPart | PatchPart | FilePart | LoadingPart | ErrorPart | TokenUsagePart;
type SessionMessage = {
  id: string;
  role: SessionMessageRole;
  parts: SessionMessagePart[];
  index?: number;
  createdAt?: number;
  modelId?: string;
  providerId?: string;
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: {
      read?: number;
      write?: number;
    };
  };
};
type JsonPatch = {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
};
type AgentCapability = "SessionFork" | "ContextUsage" | "Approvals" | "SessionReattach";
type QuestionResponse = {
  answers: string[][];
  callId?: string;
};
type HarnessQuestionReplyError = Error & {
  readonly questionRejected: true;
};
type HarnessQuestionOption = {
  label: string;
  description?: string;
};
type HarnessQuestion = {
  question: string;
  options?: HarnessQuestionOption[];
  multiple?: boolean;
};
type HarnessQuestionRequest = {
  id: string;
  toolUseId: string;
  questions: HarnessQuestion[];
};
type HarnessQuestionChannel = {
  ask(request: HarnessQuestionRequest): Promise<QuestionResponse>;
};
type ApprovalRequest = {
  id: string;
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
};
type ApprovalResponse = {
  id: string;
  decision: "approve" | "deny" | "timeout";
};
type TimeoutStrategy = "activity" | "provider";
type HarnessEventSink = {
  push(patch: JsonPatch): void;
  getMessages(): readonly SessionMessage[];
};
type HarnessAttachment = {
  fileId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  localPath: string;
  url: string;
};
type HarnessApprovalChannel = {
  requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;
};
type HarnessParamValue = string | boolean;
type HarnessParams = Record<string, HarnessParamValue>;
type HarnessWorkspaceContext = {
  workspaceId: string;
  executionTarget: WorkspaceExecutionTarget;
};
type HarnessExitStatus = "completed" | "failed" | "cancelled" | "disconnected";
type HarnessExit = {
  status: HarnessExitStatus;
};
type HarnessSession = {
  agentSessionId?: string;
  done: Promise<HarnessExit>;
  stop(): void | Promise<void>;
  replyQuestion?(response: QuestionResponse): Promise<void>;
  timeoutStrategy?: TimeoutStrategy;
  pid?: number;
};
type HarnessStartInput = {
  prompt: string;
  sessionId: string;
  cwd?: string;
  workspace?: HarnessWorkspaceContext;
  model?: string | null;
  params?: HarnessParams;
  attachments?: HarnessAttachment[];
  events: HarnessEventSink;
  questions?: HarnessQuestionChannel;
  signal?: AbortSignal;
};
type HarnessResumeInput = HarnessStartInput & {
  agentSessionId: string;
  messageOffset?: number;
  questionResponse?: QuestionResponse;
  approvals?: HarnessApprovalChannel;
};
type HarnessReattachInput = {
  sessionId: string;
  agentSessionId: string;
  cwd?: string;
  workspace?: HarnessWorkspaceContext;
  events: HarnessEventSink;
  signal?: AbortSignal;
};
type HarnessMessagesInput = {
  agentSessionId: string;
  cwd?: string;
  workspace?: HarnessWorkspaceContext;
};
type HarnessRecoveryInput = {
  knownMessages: readonly SessionMessage[];
  nativeMessages: readonly SessionMessage[];
  cwd?: string;
  workspace?: HarnessWorkspaceContext;
};
type HarnessRecoveryResult = {
  kind: "recovered";
  messages: SessionMessage[];
} | {
  kind: "conflict";
  category: string;
};
interface HarnessContext {
  projectId?: string;
  extensionId: string;
  name: string;
  process: ExtensionProcessApi;
  net: ExtensionNetApi;
  connections: ExtensionConnectionsApi;
  logger: ExtensionLoggerApi;
  state: HarnessStateApi;
}
interface HarnessStateApi {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}
interface HarnessDetectionResult {
  available: boolean;
  version?: string;
  reason?: string;
}
interface HarnessSkillsLayout {
  dir: string;
  globalDir?: string;
}
type RetryableHarnessReattachError = Error & {
  readonly retryable: true;
};
type HarnessParamDescriptor = (Omit<SelectParam, "options" | "allowCustomValues"> & {
  options: ParamOption[];
}) | BooleanParam;
type HarnessParamsSchema = Record<string, HarnessParamDescriptor>;
interface HarnessProvider extends ContributionDefinition<"harness"> {
  label: Localizable<string>;
  skills?: HarnessSkillsLayout;
  params?: HarnessParamsSchema;
  cwdRequirement?: "required" | "optional";
  capabilities(ctx: HarnessContext): MaybePromise<AgentCapability[]>;
  detect?(ctx: HarnessContext): MaybePromise<HarnessDetectionResult>;
  listModels?(ctx: HarnessContext): MaybePromise<AgentModel[]>;
  start(ctx: HarnessContext, input: HarnessStartInput): MaybePromise<HarnessSession>;
  resume(ctx: HarnessContext, input: HarnessResumeInput): MaybePromise<HarnessSession>;
  reattach?(ctx: HarnessContext, input: HarnessReattachInput): MaybePromise<HarnessSession>;
  getMessages?(ctx: HarnessContext, input: HarnessMessagesInput): MaybePromise<SessionMessage[]>;
  recoverMessages?(ctx: HarnessContext, input: HarnessRecoveryInput): MaybePromise<HarnessRecoveryResult>;
  dispose?(ctx: HarnessContext): MaybePromise<void>;
}
interface ResourceConstraint {
  readonly kinds: readonly ResourceKindRef[];
}
interface ResourceBinding extends ResourceConstraint {
  readonly view: ViewRef;
  readonly cardinality: "one" | "many";
  readonly add?: NavigationTarget;
}
interface BaseControl {
  id: string;
  name: string;
  description?: string;
  readOnly?: boolean;
}
interface NumberControl extends BaseControl {
  type: "number";
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}
interface BooleanControl extends BaseControl {
  type: "boolean";
  defaultValue: boolean;
}
interface TextControl extends BaseControl {
  type: "text";
  defaultValue: string;
  singleLine?: boolean;
}
interface MarkdownControl extends BaseControl {
  type: "markdown";
  defaultValue: string;
  placeholder?: string;
}
interface SelectionOption {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  disabled?: boolean;
}
interface SelectionGroup {
  id: string;
  name: string;
  defaultValue: string;
  options: SelectionOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
}
interface SelectionControl extends BaseControl {
  allowCustomValues?: boolean;
  type: "selection";
  defaultValue: string | string[];
  options: SelectionOption[];
  multiSelect?: boolean;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  group?: SelectionGroup;
  clearable?: boolean;
  disabled?: boolean;
}
interface DateControl extends BaseControl {
  type: "date";
  defaultValue: string;
  min?: string;
  max?: string;
}
interface ColorControl extends BaseControl {
  type: "color";
  defaultValue: string;
}
interface ParamEditorReadOnlyImage {
  src: string;
  alt: string;
}
type ParamEditorReadOnlyContent = string | number | boolean | null | Array<string | number | boolean | null> | {
  type: "image";
  src: string;
  alt: string;
} | {
  type: "image-gallery";
  images: ParamEditorReadOnlyImage[];
};
interface ReadOnlyControl extends BaseControl {
  type: "readOnly";
  value: ParamEditorReadOnlyContent;
}
type ResourceRefValue = ResourceRef;
interface ResourceOption {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  href?: string;
  ref?: ResourceRefValue;
  copyText?: string;
}
interface ResourceControl extends BaseControl {
  type: "resource";
  defaultValue: string | string[];
  options: ResourceOption[];
  multiSelect?: boolean;
  editable?: boolean;
  placeholder?: string;
  emptyText?: string;
}
type RangeValue = [number, number];
interface RangeControl extends BaseControl {
  type: "range";
  defaultValue: RangeValue;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  markerCount?: number;
}
interface SegmentedOption {
  id: string;
  name: string;
  icon?: string;
  indicatorColor?: string;
}
interface SegmentedControl extends BaseControl {
  type: "segmented";
  defaultValue: string;
  options: SegmentedOption[];
  variant?: "default" | "dots";
}
interface ActionOption {
  id: string;
  name: string;
  icon?: string;
  disabled?: boolean;
}
interface ActionsControl extends BaseControl {
  type: "actions";
  defaultValue?: string;
  options: ActionOption[];
}
type AnchorGridValue = "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right";
interface AnchorGridControl extends BaseControl {
  type: "anchorGrid";
  defaultValue: AnchorGridValue;
}
type VectorValue = {
  x: number;
  y: number;
};
interface VectorControl extends BaseControl {
  type: "vector";
  defaultValue: VectorValue;
  coordinateMode?: "cartesian" | "screen";
  xLabel?: string;
  yLabel?: string;
  min?: number;
  max?: number;
  step?: number;
}
type ControlParam = NumberControl | BooleanControl | TextControl | MarkdownControl | SelectionControl | DateControl | ColorControl | ReadOnlyControl | ResourceControl | RangeControl | SegmentedControl | ActionsControl | AnchorGridControl | VectorControl;
interface ControlGroup {
  id: string;
  title: string;
  description?: string;
  params: ControlParam[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}
type ControlValue = number | string | boolean | null | string[] | RangeValue | VectorValue;
type ControlValueMap = Record<string, ControlValue>;
type ControlsResourceRef = ResourceRef;
interface ControlsQueryParams {
  renderer: RendererContext;
}
interface ControlsQueryResult {
  params?: ControlParam[];
  groups?: ControlGroup[];
  values?: ControlValueMap;
  readOnly?: boolean;
}
interface ControlsUpdateValueInput {
  renderer: RendererContext;
  controlId: string;
  value: ControlValue;
  values: ControlValueMap;
}
interface ControlsApplyInput {
  renderer: RendererContext;
  values: ControlValueMap;
}
interface ControlsResetInput {
  renderer: RendererContext;
  controlIds?: string[];
}
interface ControlsRendererContribution extends RendererContributionBase {
  query: RendererCallback<ControlsQueryParams, ControlsQueryResult>;
  onValueChange?: RendererCallback<ControlsUpdateValueInput, unknown>;
  onApply?: RendererCallback<ControlsApplyInput, unknown>;
  onReset?: RendererCallback<ControlsResetInput, unknown>;
  defaultValues?: ControlValueMap;
}
type DataTableRendererResourceRef = ResourceRef;
interface DataTableRendererSettings {
  grouping: string;
  rowNumbers: boolean;
  wrapRows: boolean;
  showStats: boolean;
  hiddenColumns: string[];
  columnOrder: string[];
}
export declare const DEFAULT_DATA_TABLE_SETTINGS: DataTableRendererSettings;
interface DataTableRendererSavedView {
  id: string;
  title: Localizable<string>;
  settings?: Partial<DataTableRendererSettings>;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
}
interface DataTableRendererQueryParams {
  renderer: RendererContext;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
  settings: DataTableRendererSettings;
}
interface DataTableRendererThemeColor {
  light: string;
  dark: string;
  foreground?: {
    light: string;
    dark: string;
  };
}
type DataTableRendererColumnStat = {
  type: "unique";
} | {
  type: "histogram";
  bins?: number;
} | {
  type: "top-values";
  limit?: number;
};
type DataTableRendererColumnRenderer = {
  type: "json";
} | {
  type: "color-scale";
  stops: Array<{
    value: number;
    color: DataTableRendererThemeColor;
  }>;
} | {
  type: "categorical-color";
  categories: Array<{
    value: string | number | boolean | null;
    color: DataTableRendererThemeColor;
  }>;
};
interface DataTableRendererColumn {
  id: string;
  label?: Localizable<string>;
  type?: "string" | "number" | "boolean" | "date";
  groupable?: boolean;
  description?: Localizable<string>;
  icon?: string;
  hidden?: boolean;
  stat?: DataTableRendererColumnStat;
  renderer?: DataTableRendererColumnRenderer;
}
interface DataTableRendererRow {
  id: string;
  values: Record<string, JsonValue>;
  resource?: DataTableRendererResourceRef;
}
interface DataTableRendererQueryResult {
  rows: DataTableRendererRow[];
  columns?: DataTableRendererColumn[];
}
interface DataTableRendererRowAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  destructive?: boolean;
  command: CommandRef<TParams, unknown>;
}
interface DataTableRendererSelectionAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  destructive?: boolean;
  command: CommandRef<TParams, unknown>;
}
type DataTableRendererRowActivationHandler = RendererCallback<{
  row: DataTableRendererRow;
}, void>;
interface DataTableRendererContribution extends RendererContributionBase {
  toolbarActions?: ViewToolbarAction[];
  columns?: DataTableRendererColumn[];
  query: RendererCallback<DataTableRendererQueryParams, DataTableRendererQueryResult>;
  selectionMode?: "none" | "multiple";
  selectionActions?: DataTableRendererSelectionAction[];
  rowActions?: DataTableRendererRowAction[];
  onRowActivate?: DataTableRendererRowActivationHandler;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  defaultSettings?: Partial<DataTableRendererSettings>;
  defaultFilter?: ViewFilterGroup;
  defaultSorts?: ViewSort[];
  defaultViews?: DataTableRendererSavedView[];
  defaultActiveViewId?: string;
}
type TreeRendererResourceRef = ResourceRef;
interface TreeRendererState {
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  selectedNodeId?: string;
}
interface TreeRendererQueryParams {
  renderer: RendererContext;
  state?: TreeRendererState;
  filter?: string;
}
interface TreeRendererChildrenParams extends TreeRendererQueryParams {
  node: TreeNode;
}
interface TreeRendererActionParams extends TreeRendererQueryParams {
  actionId: string;
  node?: TreeNode;
}
type TreeNodeTarget = NavigationTarget;
interface TreeAction {
  id: string;
  label?: Localizable<string>;
  icon?: string;
  command?: CommandRef<Struct, unknown>;
  params?: Struct;
  input?: ParamObjectSchema;
  submitLabel?: string;
  when?: string;
  disabled?: boolean;
}
interface TreeSectionEmptyState {
  title: Localizable<string>;
  description?: Localizable<string>;
  icon?: string;
}
type TreeNodeRowVariant = "empty-state";
interface TreeNode {
  id: string;
  label: Localizable<string>;
  icon?: string;
  iconColor?: string;
  iconTooltip?: string;
  resource?: TreeRendererResourceRef;
  target?: TreeNodeTarget;
  rowVariant?: TreeNodeRowVariant;
  actions?: TreeAction[];
  contextMenuActions?: TreeAction[];
  collapsible?: boolean;
  disabled?: boolean;
  selected?: boolean;
  children?: TreeNode[];
  description?: string;
  contextValue?: string;
  hiddenByDefault?: boolean;
  canHide?: boolean;
  metadata?: JsonObject;
}
interface TreeViewSection {
  id: string;
  label?: Localizable<string>;
  actions?: TreeAction[];
  collapsible?: boolean;
  emptyState?: TreeSectionEmptyState;
  nodes: TreeNode[];
  hiddenByDefault?: boolean;
  canHide?: boolean;
}
interface TreeRendererContribution extends RendererContributionBase {
  searchable?: boolean;
  searchPlaceholder?: Localizable<string>;
  header?: RendererCallback<TreeRendererQueryParams, TreeViewSection[]>;
  body: RendererCallback<TreeRendererQueryParams, TreeViewSection[]>;
  children?: RendererCallback<TreeRendererChildrenParams, TreeNode[]>;
  footer?: RendererCallback<TreeRendererQueryParams, TreeViewSection[]>;
  defaultExpandedSectionIds?: string[];
  defaultExpandedNodeIds?: string[];
}
type TreeRendererCommandResult = TreeViewSection[] | TreeNode[] | JsonValue;
type NativeViewBody<Kind extends string, Definition> = {
  readonly kind: Kind;
  readonly resourceKind?: ResourceKindRef;
} & Omit<Definition, "title" | "icon" | "resourceKind">;
type WebviewViewBody = {
  readonly kind: "webview";
} & WebviewContribution;
type TreeViewBody = NativeViewBody<"tree", TreeRendererContribution>;
type FileViewBody = NativeViewBody<"file", FileRendererContribution>;
type ControlsViewBody = NativeViewBody<"controls", ControlsRendererContribution>;
type KanbanViewBody = NativeViewBody<"kanban", KanbanRendererContribution>;
type DataTableViewBody = NativeViewBody<"dataTable", DataTableRendererContribution>;
type ViewBody = WebviewViewBody | TreeViewBody | FileViewBody | ControlsViewBody | KanbanViewBody | DataTableViewBody;
interface ViewContribution extends ContributionDefinition<"view"> {
  readonly title: Localizable<string>;
  readonly icon?: string;
  readonly body: ViewBody;
}
type NavigationOwnerRef = ModeRef | PageRef;
type NavigationTreeSlot = "header" | "content" | "footer";
interface NavigationItemContribution extends ContributionDefinition<"navigation-item"> {
  readonly owner: NavigationOwnerRef;
  readonly slot?: NavigationTreeSlot;
  readonly label: Localizable<string>;
  readonly icon?: string;
  readonly group?: string;
  readonly when?: WhenExpression;
  readonly action: NavigationTarget;
}
interface NavigationTreeContribution extends ContributionDefinition<"navigation-tree"> {
  readonly owner: NavigationOwnerRef;
  readonly slot?: NavigationTreeSlot;
  readonly view: ViewRef;
  readonly resourceScope?: "project" | "selection";
}
type PlacementPresence = "fixed" | "open" | "closed";
type PlacementItem = {
  readonly kind: "view";
  readonly view: ViewRef;
  readonly presence: PlacementPresence;
} | {
  readonly kind: "binding";
  readonly binding: ResourceBinding;
};
type PlacementMountStrategy = "active" | "keep-mounted";
interface PlacementTabMenuRow {
  readonly id: string;
  readonly label: Localizable<string>;
  readonly icon?: string;
  readonly iconColor?: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly action?: NavigationTarget;
}
interface PlacementTabMenuGroup {
  readonly id: string;
  readonly rows: readonly PlacementTabMenuRow[];
}
interface PlacementTabSnapshot extends Struct {
  readonly label?: Localizable<string>;
  readonly icon?: string;
  readonly indicator?: {
    readonly icon: string;
    readonly color?: string;
    readonly label?: Localizable<string>;
  };
  readonly menu?: readonly PlacementTabMenuGroup[];
}
interface PlacementTabPresentation {
  readonly query: RendererCallback<JsonObject, PlacementTabSnapshot>;
  readonly refreshEvents?: readonly RendererEventReference[];
}
interface PlacementPresentation {
  readonly mountStrategy?: PlacementMountStrategy;
  readonly hiddenByDefault?: boolean;
  readonly headerBorderBottom?: boolean;
  readonly tab?: PlacementTabPresentation;
}
interface PlacementContribution extends ContributionDefinition<"placement">, PlacementPresentation {
  readonly mode: ModeRef;
  readonly item: PlacementItem;
  readonly region: ExtensionPanelRegion;
  readonly order?: number;
  readonly movableTo?: readonly ExtensionPanelRegion[];
}
interface ViewMenuContribution extends ContributionDefinition<"view-menu"> {
  readonly owner: ViewRef;
  readonly view: ViewRef;
  readonly side: "left" | "right";
  readonly group?: string;
  readonly placement?: "first" | "default" | "last";
  readonly hostTreeHeader?: "default" | "none";
  readonly hostTreeFooter?: "default" | "none";
}
type PageSlotRole = "primary" | "auxiliary";
type PageSlotCardinality = "one" | "many";
type PageOpenIntent = "preview" | "pin";
type PageSlotRegion = ExtensionPanelRegion;
interface PageMainView extends PlacementPresentation {
  readonly kind: "view";
  readonly view: ViewRef;
  readonly cardinality: PageSlotCardinality;
}
interface PageMainPanels {
  readonly kind: "panels";
  readonly empty: ViewRef;
}
type PageMain = PageMainView | PageMainPanels;
interface PageSlot extends PlacementPresentation {
  readonly id: string;
  readonly region: PageSlotRegion;
  readonly order?: number;
  readonly item: PlacementItem;
  readonly openOn?: "page-resource";
}
interface PageSlotRef {
  readonly kind: "page-slot";
  readonly page: PageRef;
  readonly id: string;
}
type PanelRef = PlacementRef | PageSlotRef;
interface PageContribution extends ContributionDefinition<"page"> {
  readonly title: Localizable<string>;
  readonly icon?: string;
  readonly path: string;
  readonly mode: ModeRef;
  readonly parent?: PageRef;
  readonly resource?: ResourceConstraint;
  readonly main: PageMain;
  readonly slots: readonly PageSlot[];
  readonly panels: Readonly<Record<string, PageSlotRef>>;
}
type PlacementOwner = {
  readonly kind: "shell";
  readonly placementId: string;
} | {
  readonly kind: "mode";
  readonly modeId: string;
  readonly placementId: string;
} | {
  readonly kind: "page";
  readonly pageId: string;
  readonly slotId: string;
};
type PlacementIdentity = PlacementOwner & {
  readonly instanceKey: string;
};
interface PageLocation {
  readonly page: PageRef;
  readonly resource?: ResourceRef;
  readonly section?: FileRendererSectionTarget;
  readonly parent?: PageLocation;
}
interface WorkflowStatus {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly icon?: string | null;
  readonly sortOrder: number;
  readonly isDefault?: boolean;
  readonly actions?: readonly string[];
}
interface StatusActionDefinition {
  readonly id: string;
  readonly label: Localizable<string>;
  readonly icon?: string;
}
interface StatusContribution extends ContributionDefinition<"status"> {
  readonly title: Localizable<string>;
  readonly actions?: readonly StatusActionDefinition[];
  readonly query: (ctx: ExtensionContextBase, input: Record<string, never>) => MaybePromise<{
    statuses: readonly WorkflowStatus[];
  }>;
  readonly save?: (ctx: ExtensionContextBase, input: {
    statuses: readonly WorkflowStatus[];
  }) => MaybePromise<{
    statuses: readonly WorkflowStatus[];
  }>;
}
interface StatusBarItemContribution extends ContributionDefinition<"status-bar-item"> {
  readonly view: ViewRef;
  readonly slot: StatusBarSlotRef;
  readonly order?: number;
  readonly when?: WhenExpression;
}
export declare const EXTENSION_API_VERSION = "0.1.2";
type SchemaParams<TSchema extends ParamObjectSchema | undefined> = TSchema extends ParamObjectSchema ? ParamsOf<TSchema> : Record<string, never>;
interface WorkspaceProviderRef {
  version: number;
  data: JsonObject;
}
interface WorkspaceProviderCreateInput {
  operationId: string;
  projectId: string;
  workspaceId: string;
  params: JsonObject;
  signal?: AbortSignal;
}
interface WorkspaceProviderResolveInput {
  projectId: string;
  workspaceId: string;
  providerRef: WorkspaceProviderRef;
}
interface WorkspaceProviderMutationInput extends WorkspaceProviderResolveInput {
  operationId: string;
}
type WorkspaceProviderState = "provisioning" | "ready" | "failed" | "cancelled" | "archiving" | "archived" | "deleting" | "provider_missing";
type WorkspaceExecutionTarget = {
  kind: "local";
  rootPath: string;
  displayPath?: string;
} | {
  kind: "remote";
  providerId: string;
  providerRef: WorkspaceProviderRef;
  displayPath?: string;
};
interface WorkspaceCapabilities {
  files: "none" | "read" | "write";
  diff: boolean;
  merge: boolean;
  rebase: boolean;
  archive: boolean;
  delete: boolean;
}
interface WorkspaceProviderResult {
  providerRef?: WorkspaceProviderRef;
  branch?: string;
  state: WorkspaceProviderState;
  executionKind: "local" | "remote";
  executionTarget?: WorkspaceExecutionTarget;
  displayPath?: string;
  capabilities: WorkspaceCapabilities;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
interface CommandDefinition<TSchema extends ParamObjectSchema | undefined = ParamObjectSchema | undefined, TResult = unknown, TSettings extends Record<string, unknown> = Record<string, unknown>> extends ContributionDefinition<"command"> {
  readonly ref: CommandRef<SchemaParams<TSchema>, TResult>;
  title: Localizable<string>;
  description?: Localizable<string>;
  params?: TSchema;
  menus?: readonly MenuContribution[];
  palette?: readonly CommandPaletteContribution<SchemaParams<TSchema>>[];
  cli?: true | CliContribution;
  automation?: true;
  mutating?: true;
  run: CommandRunHandler<SchemaParams<TSchema>, TResult, TSettings>;
}
interface MiddlewareDefinition<TParams extends Struct = Struct, TResult = unknown> extends ContributionDefinition<"middleware"> {
  command: CommandRef<TParams, TResult>;
  run: CommandMiddlewareHandler<TParams>;
}
interface HookDefinition<TPayload extends Struct = Struct> extends ContributionDefinition<"hook"> {
  event: EventRef<TPayload>;
  run(ctx: EventContext, payload: TPayload): MaybePromise<void>;
}
type ScheduleExpression = string;
interface ScheduleContribution<TParams extends Struct = Struct> extends ContributionDefinition<"schedule"> {
  title: Localizable<string>;
  schedule: ScheduleExpression;
  command: CommandRef<TParams, unknown>;
  params?: TParams;
  workspaceId?: string;
  disabled?: boolean;
}
interface WorkspaceTypeProvider extends ContributionDefinition<"workspace-type"> {
  label: Localizable<string>;
  icon?: string;
  params?: ParamObjectSchema;
  create(ctx: ExtensionContextBase, input: WorkspaceProviderCreateInput): MaybePromise<WorkspaceProviderResult>;
  resolve(ctx: ExtensionContextBase, input: WorkspaceProviderResolveInput): MaybePromise<WorkspaceProviderResult>;
  cancel?(ctx: ExtensionContextBase, input: WorkspaceProviderMutationInput): MaybePromise<WorkspaceProviderResult>;
  archive?(ctx: ExtensionContextBase, input: WorkspaceProviderMutationInput): MaybePromise<WorkspaceProviderResult>;
  delete?(ctx: ExtensionContextBase, input: WorkspaceProviderMutationInput): MaybePromise<void>;
}
interface ExtensionConnectionContribution extends ContributionDefinition<"connection"> {
  label: Localizable<string>;
  transport: "http";
  auth: {
    type: "bearer";
  } | {
    type: "header";
    headerName: string;
  };
  allowedMethods: readonly ("GET" | "POST" | "PUT" | "PATCH" | "DELETE")[];
  allowedPathPrefixes: readonly string[];
  check?: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
  };
  supportsStreaming?: boolean;
}
interface LocalExtensionSource {
  name: string;
  path: string;
  origin?: string;
  installedAt: string;
  updatedAt: string;
}
type ExtensionLoadScope = "user" | "repo";
interface PackageManifest {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  publisher: string;
  main: string;
  enginesPstdio: string;
  pstdio?: {
    scope?: ExtensionLoadScope;
  };
  id: string;
}
interface UiContributions {
  views?: readonly ViewContribution[];
  viewMenus?: readonly ViewMenuContribution[];
  placements?: readonly PlacementContribution[];
  navigationItems?: readonly NavigationItemContribution[];
  navigationTrees?: readonly NavigationTreeContribution[];
  statusBarItems?: readonly StatusBarItemContribution[];
  statuses?: readonly StatusContribution[];
  modes?: readonly ModeContribution[];
  pages?: readonly PageContribution[];
  resourceKinds?: readonly ResourceKindDefinition[];
  activityItems?: readonly ActivityItemContribution[];
  settingsSections?: readonly SettingsSectionContribution[];
  settingsPanels?: readonly SettingsPanelContribution[];
  commandPaletteResources?: readonly CommandPaletteResourceContribution[];
  keybindings?: readonly KeybindingContribution[];
}
interface BehaviourContributions {
  commands?: readonly CommandDefinition<any, any, any>[];
  middlewares?: readonly MiddlewareDefinition<any, any>[];
  hooks?: readonly HookDefinition<any>[];
  schedules?: readonly ScheduleContribution<any>[];
}
interface AssetContributions {
  artifactMounts?: readonly ArtifactMountContribution[];
  templateTypes?: readonly TemplateTypeContribution[];
  templates?: readonly TemplateContribution[];
  skills?: readonly SkillContribution[];
  themes?: readonly ThemeContribution[];
  fileIconThemes?: readonly FileIconThemeContribution[];
  translations?: Record<string, PackageAssetDescriptor>;
  defaultLocale?: string;
}
interface ProviderContributions {
  connections?: readonly ExtensionConnectionContribution[];
  workspaceTypes?: readonly WorkspaceTypeProvider[];
  harnesses?: readonly HarnessProvider[];
  resourceHierarchyProviders?: readonly ResourceHierarchyProvider[];
}
interface ExtensionDefinition extends UiContributions, BehaviourContributions, AssetContributions, ProviderContributions {
  settings?: ExtensionSettingsContribution;
}
type ExtensionSourceKind = "local_path" | "git" | "registry";
interface ExtensionWorkspace {
  id: string;
  name?: string;
  project_id?: string;
  is_default?: boolean;
  workspace_shorthand?: string;
  branch?: string | null;
  root_path?: string | null;
  provider_id?: string;
  provider_state?: WorkspaceProviderState;
  execution_kind?: "local" | "remote";
  display_path?: string | null;
  provider_capabilities_json?: WorkspaceCapabilities;
  anchors_json?: ResourceAnchor[];
  initializing?: boolean;
  setup_error?: string | null;
  created_at?: string;
  updated_at?: string;
}
interface CreateExtensionWorkspaceInput {
  project_id?: string;
  shorthand_base: string;
  provider_id: string;
  params?: JsonObject;
  anchors?: ResourceAnchor[];
}
interface CreateWorkspaceCommandParams {
  anchors?: ResourceAnchor[];
  shorthand_base?: string;
}
interface ExtensionWorkspaceProvider {
  id: string;
  label: Localizable<string>;
  icon?: string;
  description?: Localizable<string>;
  params: ParamObjectSchema;
}
interface ExtensionWorkspacesApi {
  listProviders(): Promise<ExtensionWorkspaceProvider[]>;
  getDefault(): Promise<ExtensionWorkspace | null>;
  list(): Promise<ExtensionWorkspace[]>;
  get(id: string): Promise<ExtensionWorkspace | null>;
  getByShorthand(shorthand: string): Promise<ExtensionWorkspace | null>;
  create(input: CreateExtensionWorkspaceInput): Promise<ExtensionWorkspace>;
  addAnchors(workspaceId: string, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(workspaceId: string, refs: Pick<ResourceRef, "type" | "id">[]): Promise<void>;
  resolve(id: string): Promise<WorkspaceProviderResult>;
  cancel(id: string): Promise<ExtensionWorkspace>;
  archive(id: string): Promise<ExtensionWorkspace>;
  removeWorktree(id: string): Promise<{
    removed: boolean;
  }>;
  delete(id: string): Promise<void>;
}
interface CreateWorkspaceCommandParams {
  anchors?: ResourceAnchor[];
  shorthand_base?: string;
}
interface ExtensionStorageCollectionApi<TItem = unknown> {
  get(id: string): Promise<TItem | undefined>;
  list(): Promise<TItem[]>;
  put(id: string, value: TItem): Promise<void>;
  update(id: string, value: TItem): Promise<void>;
  createIfAbsent(id: string, value: TItem): Promise<boolean>;
  deleteIfValue(id: string, value: TItem): Promise<boolean>;
  create(value: TItem): Promise<TItem & {
    id: string;
  }>;
  delete(id: string): Promise<void>;
  attachments(itemId: string): ExtensionBlobsApi;
}
type StorageScope = {
  type: "project";
} | {
  type: "resource";
  resource: ResourceRef;
} | {
  type: string;
  id: string;
};
interface ExtensionStorageApi {
  scope(scope: StorageScope): ExtensionStorageApi;
  files: ExtensionBlobsApi;
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  collection<TItem = unknown>(name: string): ExtensionStorageCollectionApi<TItem>;
}
interface ExtensionBlobRef {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  hash: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}
interface ExtensionBlobInput {
  name: string;
  data: Uint8Array | ArrayBuffer;
  mimeType?: string | null;
}
interface ExtensionBlobsApi {
  put(input: ExtensionBlobInput): Promise<ExtensionBlobRef>;
  get(id: string): Promise<ExtensionBlobRef | undefined>;
  getBytes(id: string): Promise<Uint8Array>;
  list(): Promise<ExtensionBlobRef[]>;
  delete(id: string): Promise<void>;
  urlFor(id: string): string;
}
interface ArtifactFile {
  path: string;
  size?: number;
  updatedAt?: string;
}
interface ArtifactMount {
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, value: string): Promise<void>;
  updateText(path: string, value: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, value: Uint8Array): Promise<void>;
  list(pattern?: string): Promise<ArtifactFile[]>;
  listDirs(path?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
}
type ExtensionPackageFilesApi = Pick<ArtifactMount, "exists" | "readText" | "readBytes" | "list" | "listDirs">;
interface WorkspaceSyncFile {
  path: string;
  content: string;
}
interface WorkspaceFilesMount extends ArtifactMount {
  syncDir(dir: string, files: WorkspaceSyncFile[]): Promise<void>;
}
interface ExtensionArtifactApi {
  mount(key: string): ArtifactMount;
}
interface ExtensionFilesApi {
  readText(fileId: string): Promise<string>;
  writeText(fileId: string, value: string): Promise<void>;
  createText(input: {
    name: string;
    content: string;
    metadata?: JsonObject;
  }): Promise<{
    id: string;
  }>;
  delete(fileId: string): Promise<void>;
}
interface ExtensionSkillsApi {
  list(): Promise<Skill[]>;
}
interface ExtensionSessionResource {
  type: "session";
  id: string;
  title: string;
  status: SessionStatus;
}
interface ExtensionSessionsApi {
  get(id: string): Promise<{
    id: string;
    title: string;
    status?: string;
    original_session_id?: string | null;
    cwd?: string | null;
    updated_at?: string | null;
    anchors_json?: ResourceAnchor[];
  } | null>;
  list(): Promise<Array<{
    id: string;
    title: string;
    status: SessionStatus;
    last_request_started?: string | null;
    last_request_ended?: string | null;
    updated_at?: string | null;
    anchors_json?: ResourceAnchor[];
  }>>;
  listByWorkspace(workspaceId: string): Promise<Array<{
    id: string;
    title: string;
    status: SessionStatus;
    created_at?: string | null;
    updated_at?: string | null;
    anchors_json?: ResourceAnchor[];
  }>>;
  create(input: {
    title: string;
    prompt?: string;
    harness?: ExtensionHarnessInput;
    workspaceId?: string;
    anchors?: ResourceAnchor[];
    attachments?: SessionAttachmentRef[];
    originalSessionId?: string;
  }): Promise<ExtensionSessionResource>;
  followup(input: {
    sessionId: string;
    prompt?: string;
    attachments?: SessionAttachmentRef[];
  }): Promise<void>;
  addAnchors(sessionId: string, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(sessionId: string, refs: Pick<ResourceRef, "type" | "id">[]): Promise<void>;
}
interface ExtensionHarnessInput {
  harnessId: string;
  model?: string;
}
interface ExtensionEventsApi {
  emit<TPayload extends Struct>(event: EventRef<TPayload> | string, payload: TPayload): Promise<EventDeliveryResult>;
}
interface ExtensionActivityApi {
  record(input: {
    message: string;
    target?: ResourceRef;
    related?: ResourceRef[];
    metadata?: JsonObject;
  }): Promise<{
    id: string;
  }>;
}
interface ExtensionNotifyApi {
  toast(notice: CommandNotice): Promise<void>;
  action(input: Omit<CreateNotificationInput, "projectId">): Promise<Notification>;
  resolve(input: {
    id?: string;
    dedupeKey?: string;
    status?: Extract<NotificationStatus, "done" | "dismissed" | "expired">;
  }): Promise<Notification[]>;
  dismiss(input: {
    id?: string;
    dedupeKey?: string;
  }): Promise<Notification[]>;
}
interface ProcessRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
interface ProcessRunInput {
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}
interface ExtensionProcessApi {
  run(input: ProcessRunInput): Promise<ProcessRunResult>;
  runOrThrow(input: ProcessRunInput): Promise<ProcessRunResult>;
  spawnDetached(input: {
    command: string[];
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<{
    pid?: number;
  }>;
}
interface ExtensionTerminalApi {
  openSession(request: TerminalSessionRequest): TerminalSessionHandle;
}
interface ExtensionNetApi {
  findFreePort(input?: {
    host?: string;
  }): Promise<number>;
}
interface ExtensionSettingsApi<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  all(): Promise<Partial<TSettings>>;
  get<TKey extends keyof TSettings & string>(key: TKey): Promise<TSettings[TKey] | undefined>;
  set<TKey extends keyof TSettings & string>(key: TKey, value: TSettings[TKey]): Promise<void>;
  delete<TKey extends keyof TSettings & string>(key: TKey): Promise<void>;
}
interface ExtensionProjectContext {
  id: string;
  name: string;
  shorthand: string;
}
interface ExtensionContextBase<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  projectId: string;
  workspaceId?: string;
  project: ExtensionProjectContext;
  extensionId: string;
  name: string;
  source?: CommandSource;
  storage: ExtensionStorageApi;
  resources: ExtensionResourcesApi;
  navigation: {
    open(target: NavigationTarget): void;
  };
  artifacts: ExtensionArtifactApi;
  projectFiles?: ArtifactMount;
  workspaceFiles?: WorkspaceFilesMount;
  packageFiles: ExtensionPackageFilesApi;
  extensionFiles?: ArtifactMount;
  files: ExtensionFilesApi;
  skills?: ExtensionSkillsApi;
  sessions: ExtensionSessionsApi;
  workspaces: ExtensionWorkspacesApi;
  commands: CommandHelpersApi;
  events: ExtensionEventsApi;
  activity: ExtensionActivityApi;
  notify: ExtensionNotifyApi;
  automation: ExtensionAutomationApi;
  process: ExtensionProcessApi;
  terminal?: ExtensionTerminalApi;
  net: ExtensionNetApi;
  connections: ExtensionConnectionsApi;
  logger: ExtensionLoggerApi;
  settings: ExtensionSettingsApi<TSettings>;
}
interface CommandContext<TSettings extends Record<string, unknown> = Record<string, unknown>> extends ExtensionContextBase<TSettings> {
  commandId: string;
  invocationId: string;
  signal: AbortSignal;
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
type CommandMiddlewareContext = CommandContext;
type CommandMiddlewareHandler<TParams extends Struct = Struct> = (ctx: CommandMiddlewareContext, params: TParams) => MaybePromise<CommandMiddlewareResult<TParams>>;
type CommandRunHandler<TParams extends Struct = Struct, TResult = unknown, TSettings extends Record<string, unknown> = Record<string, unknown>> = (ctx: CommandContext<TSettings>, params: TParams) => MaybePromise<TResult>;
type RendererCallback<TInput extends Struct = Struct, TResult = unknown, TSettings extends Record<string, unknown> = Record<string, unknown>> = (ctx: ExtensionContextBase<TSettings>, input: TInput & {
  renderer: RendererContext;
}) => MaybePromise<TResult>;
interface EventContext extends ExtensionContextBase {
  eventId: string;
  deliveryId: string;
}
type SetupContext = ExtensionContextBase;
type MigrationContext = ExtensionContextBase;
type FileRendererResourceRef = ResourceRef;
interface FileRendererSectionAnchor {
  id: string;
  heading: string;
  occurrence?: number;
}
interface FileRendererSectionTarget {
  anchors: FileRendererSectionAnchor[];
}
interface FileRendererLoadParams {
  renderer: RendererContext;
}
interface FileRendererLoadResult {
  fileName?: string;
  mimeType?: string;
  content?: string;
  dataUrl?: string;
  placeholder?: string;
  editable?: boolean;
  textRenderer?: "automatic" | "monaco";
  emptyState?: {
    title: string;
    description?: string;
  };
}
interface FileRendererSaveParams {
  renderer: RendererContext;
  content: string;
}
interface FileRendererContribution extends RendererContributionBase {
  load: RendererCallback<FileRendererLoadParams, FileRendererLoadResult>;
  save?: RendererCallback<FileRendererSaveParams, unknown>;
}
interface NavigationTargetPage {
  kind: "page";
  page: PageRef;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  open?: PageOpenIntent;
  parent?: NavigationTargetPage;
}
interface NavigationTargetPanel {
  kind: "panel";
  panel: PanelRef;
  resource?: ResourceRef;
  open?: PageOpenIntent;
}
interface NavigationTargetCommand {
  kind: "command";
  target: CommandTarget<JsonObject>;
}
interface NavigationTargetHref {
  kind: "href";
  href: string;
}
type NavigationTargetItem = NavigationTargetPage | NavigationTargetPanel | NavigationTargetCommand | NavigationTargetHref;
interface NavigationTargetCompound {
  kind: "compound";
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[];
}
type NavigationTarget = NavigationTargetItem | NavigationTargetCompound;
type CommandSource = "cli" | "dashboard" | "api" | "schedule" | "event" | "automation" | "command-panel";
interface CommandRef<TParams extends Struct = Struct, TResult = unknown> extends ContributionRef<"command"> {
  params?: TParams;
  result?: TResult;
}
interface CommandTarget<TParams extends Struct = Struct> {
  command: CommandRef<TParams, unknown>;
  params?: TParams;
}
interface SerializedError {
  name?: string;
  message: string;
  stack?: string;
  cause?: JsonValue;
}
interface WorkbenchAttachmentInvocationContext {
  target: WorkbenchAttachmentTarget;
  mode?: string;
  projectId?: string;
  resource?: ResourceRef;
}
interface CommandInvocation<TParams extends Struct = Struct> {
  params: TParams;
  resource?: ResourceRef;
  attachment?: WorkbenchAttachmentInvocationContext;
  slot?: SlotInvocationContext;
  metadata?: JsonObject;
}
interface CommandContinue {
  type: "continue";
}
interface CommandPatchParams<TParams extends Struct = Struct> {
  type: "patchParams";
  params: Partial<TParams>;
}
interface CommandReplaceParams<TParams extends Struct = Struct> {
  type: "replaceParams";
  params: TParams;
}
interface CommandReplaceInvocation<TParams extends Struct = Struct> {
  type: "replaceInvocation";
  invocation: CommandInvocation<TParams>;
}
interface CommandReject {
  type: "reject";
  code?: string;
  reason: string;
  data?: JsonObject;
}
type CommandMiddlewareResult<TParams extends Struct = Struct> = void | CommandContinue | CommandPatchParams<TParams> | CommandReplaceParams<TParams> | CommandReplaceInvocation<TParams> | CommandReject;
interface CommandNotice {
  type: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  metadata?: JsonObject;
}
interface CommandDiagnostic {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  extensionId?: string;
  commandId?: string;
  metadata?: JsonObject;
}
type CommandOutcome<TResult = unknown> = {
  ok: true;
  status: "success";
  value: TResult;
  navigationRequests?: NavigationTarget[];
  notices?: CommandNotice[];
  diagnostics?: CommandDiagnostic[];
} | {
  ok: false;
  status: "rejected";
  code?: string;
  reason: string;
  data?: JsonObject;
  notices?: CommandNotice[];
  diagnostics?: CommandDiagnostic[];
} | {
  ok: false;
  status: "error";
  code?: string;
  reason: string;
  error?: SerializedError;
  notices?: CommandNotice[];
  diagnostics?: CommandDiagnostic[];
};
interface CommandHelpersApi {
  execute<TParams extends Struct = Struct, TResult = unknown>(command: CommandRef<TParams, TResult>, invocation: CommandInvocation<TParams>): Promise<CommandOutcome<TResult>>;
  continue(): CommandContinue;
  patchParams<TParams extends Struct = Struct>(params: Partial<TParams>): CommandPatchParams<TParams>;
  replaceParams<TParams extends Struct = Struct>(params: TParams): CommandReplaceParams<TParams>;
  replaceInvocation<TParams extends Struct = Struct>(invocation: CommandInvocation<TParams>): CommandReplaceInvocation<TParams>;
  reject(input: Omit<CommandReject, "type">): CommandReject;
}
interface CommandRequestedEvent<TParams extends Struct = Struct> {
  commandId: string;
  invocationId: string;
  source?: CommandSource;
  params: TParams;
  resource?: ResourceRef;
}
interface CommandStartedEvent<TParams extends Struct = Struct> extends CommandRequestedEvent<TParams> {}
interface CommandCompletedEvent<TParams extends Struct = Struct, TResult = unknown> extends CommandStartedEvent<TParams> {
  result: TResult;
  elapsedMs: number;
}
interface CommandRejectedEvent<TParams extends Struct = Struct> extends CommandRequestedEvent<TParams> {
  code?: string;
  reason: string;
  data?: JsonObject;
}
interface CommandFailedEvent<TParams extends Struct = Struct> extends CommandRequestedEvent<TParams> {
  code?: string;
  reason: string;
  error?: SerializedError;
  elapsedMs: number;
}
type CommandLifecyclePhase = "requested" | "started" | "completed" | "rejected" | "failed";
type CommandLifecycleEventPayload<TPhase extends CommandLifecyclePhase, TParams extends Struct = Struct, TResult = unknown> = TPhase extends "requested" ? CommandRequestedEvent<TParams> : TPhase extends "started" ? CommandStartedEvent<TParams> : TPhase extends "completed" ? CommandCompletedEvent<TParams, TResult> : TPhase extends "rejected" ? CommandRejectedEvent<TParams> : CommandFailedEvent<TParams>;
export declare const dockedWorkbenchRegions: readonly ["sidenav", "main", "secondary", "side"];
type DockedWorkbenchRegion = (typeof dockedWorkbenchRegions)[number];
export declare const extensionPanelRegions: readonly ["main", "secondary", "side"];
type ExtensionPanelRegion = (typeof extensionPanelRegions)[number];
interface RegionSize {
  readonly defaultPx?: number;
  readonly minPx?: number;
  readonly maxPx?: number;
}
interface ResourceMenuSlotDefinition {
  readonly id: string;
  readonly placement: "header-primary" | "header-overflow" | "context-menu";
  readonly label?: Localizable<string>;
  readonly access: "owner" | "public";
  readonly order?: number;
}
interface ResourceKindDefinition extends ContributionDefinition<"resource-kind"> {
  readonly prefix?: string | {
    readonly $prefix: "project";
  };
  readonly label?: Localizable<string>;
  readonly icon?: string;
  readonly menuSlots?: readonly ResourceMenuSlotDefinition[];
  readonly resolve?: CommandRef;
}
interface ResourceHierarchyProvider extends ContributionDefinition<"resource-hierarchy-provider"> {
  resourceKind: ResourceKindRef;
  parent(ctx: ExtensionContextBase, resource: ResourceRef): MaybePromise<ResourceRef | ViewHierarchyParent | null>;
}
export declare const workbenchModes: {
  project: {
    extensionId: string;
    kind: "mode";
    id: string;
  };
  sessions: {
    extensionId: string;
    kind: "mode";
    id: string;
  };
  settings: {
    extensionId: string;
    kind: "mode";
    id: string;
  };
};
export declare const workbenchModeDefinitions: {
  readonly project: {
    readonly ref: {
      extensionId: string;
      kind: "mode";
      id: string;
    };
    readonly regions: readonly ["sidenav", "main", "secondary", "side"];
  };
  readonly sessions: {
    readonly ref: {
      extensionId: string;
      kind: "mode";
      id: string;
    };
    readonly regions: readonly ["sidenav", "main", "secondary", "side"];
  };
  readonly settings: {
    readonly ref: {
      extensionId: string;
      kind: "mode";
      id: string;
    };
    readonly regions: readonly ["sidenav", "main", "secondary", "side"];
  };
};
export declare const workbenchResourceKindDefinitions: {
  project: ResourceKindDefinition;
  session: ResourceKindDefinition;
  workspace: ResourceKindDefinition;
};
export declare const workbenchResourceKinds: {
  project: ContributionRef<"resource-kind">;
  session: ContributionRef<"resource-kind">;
  workspace: ContributionRef<"resource-kind">;
};
export declare const workbenchPages: {
  start: {
    extensionId: string;
    kind: "page";
    id: string;
  };
  sessions: {
    extensionId: string;
    kind: "page";
    id: string;
  };
  session: {
    extensionId: string;
    kind: "page";
    id: string;
  };
  workspaces: {
    extensionId: string;
    kind: "page";
    id: string;
  };
  workspace: {
    extensionId: string;
    kind: "page";
    id: string;
  };
};
export declare const workbenchPageDefinitions: {
  readonly start: {
    readonly ref: {
      extensionId: string;
      kind: "page";
      id: string;
    };
    readonly mode: {
      extensionId: string;
      kind: "mode";
      id: string;
    };
    readonly path: "";
    readonly primary: {
      readonly cardinality: "one";
      readonly resourceKinds: readonly [];
    };
  };
  readonly sessions: {
    readonly ref: {
      extensionId: string;
      kind: "page";
      id: string;
    };
    readonly mode: {
      extensionId: string;
      kind: "mode";
      id: string;
    };
    readonly path: "sessions";
    readonly primary: {
      readonly cardinality: "one";
      readonly resourceKinds: readonly [];
    };
  };
  readonly session: {
    readonly ref: {
      extensionId: string;
      kind: "page";
      id: string;
    };
    readonly mode: {
      extensionId: string;
      kind: "mode";
      id: string;
    };
    readonly path: "session";
    readonly primary: {
      readonly cardinality: "one";
      readonly resourceKinds: readonly ["session", "session-draft"];
    };
  };
  readonly workspaces: {
    readonly ref: {
      extensionId: string;
      kind: "page";
      id: string;
    };
    readonly mode: {
      extensionId: string;
      kind: "mode";
      id: string;
    };
    readonly path: "workspaces";
    readonly primary: {
      readonly cardinality: "one";
      readonly resourceKinds: readonly [];
    };
  };
  readonly workspace: {
    readonly ref: {
      extensionId: string;
      kind: "page";
      id: string;
    };
    readonly mode: {
      extensionId: string;
      kind: "mode";
      id: string;
    };
    readonly path: "workspace";
    readonly primary: {
      readonly cardinality: "many";
      readonly resourceKinds: readonly ["workspace"];
    };
  };
};
export declare const workbenchPanels: {
  projectSession: {
    extensionId: string;
    kind: "placement";
    id: string;
  };
};
export declare const workbenchPanelDefinitions: {
  readonly projectSession: {
    readonly ref: {
      extensionId: string;
      kind: "placement";
      id: string;
    };
    readonly mode: {
      extensionId: string;
      kind: "mode";
      id: string;
    };
    readonly cardinality: "many";
    readonly resourceKinds: readonly ["session", "session-draft"];
  };
};
export declare const workbenchSlots: {
  projectSettings: {
    extensionId: string;
    kind: "settings-panel";
    id: string;
  };
  statusBarLeading: {
    extensionId: string;
    kind: "status-bar-item";
    id: string;
  };
  statusBarTrailing: {
    extensionId: string;
    kind: "status-bar-item";
    id: string;
  };
};
export declare const localContributionIdPattern: RegExp;
export declare const isValidLocalContributionId: (id: string) => boolean;
export declare const localContributionIdGrammar = "lowercase kebab-case segments separated by dots, such as \"ticket-status.create\"";
export declare const resolveDataTableComparableValue: (value: unknown, renderer?: {
  type: string;
}) => unknown;
export declare const resolveDataTableFieldKind: (values: unknown[], column?: {
  type?: "string" | "number" | "boolean" | "date";
  renderer?: {
    type: string;
  };
}) => "string" | "number" | "boolean" | "date";
type WorkspaceType = string;
interface WorkspaceProvisionPayload {
  projectId: string;
  workspaceId: string;
  workspace: ExtensionWorkspace;
  workspaceDir: string;
  projectDir?: string;
  providerId: string;
}
interface SessionLifecyclePayload {
  projectId: string;
  sessionId: string;
  sessionStatus?: string;
  originalSessionId?: string;
  workspace?: ExtensionWorkspace;
  workspaceId?: string;
  workspaceDir?: string;
  branch?: string;
  anchors?: ResourceAnchor[];
}
interface WorktreeRemovedPayload {
  projectId: string;
  repoPath?: string;
  worktreePath: string;
  workspace?: ExtensionWorkspace;
  workspaceId?: string;
  anchors?: ResourceAnchor[];
}
interface CommitPayload {
  projectId: string;
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  commitSha?: string;
  workspace?: ExtensionWorkspace;
  anchors?: ResourceAnchor[];
}
interface RebasePayload {
  projectId: string;
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  workspace?: ExtensionWorkspace;
  anchors?: ResourceAnchor[];
}
interface MergePayload extends CommitPayload {}
interface ConflictPayload {
  projectId: string;
  operation: "rebase" | "merge";
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  workspace?: ExtensionWorkspace;
  anchors?: ResourceAnchor[];
}
export declare const projectSlots: {
  sidenav: SlotRef<object, "panel">;
  headerPrimary: SlotRef<object, "menu">;
  headerOverflow: SlotRef<object, "menu">;
  settingsPanels: SlotRef<object, "settings">;
};
export declare const sessionSlots: {
  headerPrimary: SlotRef<object, "menu">;
  headerOverflow: SlotRef<object, "menu">;
};
export declare const workspaceSlots: {
  headerPrimary: SlotRef<object, "menu">;
  headerOverflow: SlotRef<object, "menu">;
  sidenav: SlotRef<object, "panel">;
};
export declare const projectEvents: {
  opened: EventRef<{
    projectId: string;
  }>;
};
export declare const viewDataEvents: {
  sessionsChanged: EventRef<{
    projectId: string;
  }>;
  workspacesChanged: EventRef<{
    projectId: string;
  }>;
  repositoriesChanged: EventRef<{
    projectId: string;
  }>;
};
export declare const sessionEvents: {
  started: EventRef<SessionLifecyclePayload & {
    anchors?: ResourceAnchor[];
  }>;
  resumed: EventRef<SessionLifecyclePayload>;
  awaitingInput: EventRef<SessionLifecyclePayload>;
  succeeded: EventRef<SessionLifecyclePayload>;
  failed: EventRef<SessionLifecyclePayload>;
  completed: EventRef<SessionLifecyclePayload & {
    anchors?: ResourceAnchor[];
  }>;
};
export declare const workspaceEvents: {
  created: EventRef<{
    workspace: ExtensionWorkspace;
  }>;
  provision: EventRef<WorkspaceProvisionPayload>;
  ready: EventRef<WorkspaceProvisionPayload>;
  archived: EventRef<{
    workspace: ExtensionWorkspace;
  }>;
  deleted: EventRef<{
    workspace: ExtensionWorkspace;
  }>;
};
export declare const worktreeEvents: {
  removed: EventRef<WorktreeRemovedPayload>;
};
export declare const gitEvents: {
  committed: EventRef<CommitPayload>;
  rebased: EventRef<RebasePayload>;
  merged: EventRef<MergePayload>;
  conflicted: EventRef<ConflictPayload>;
};
export declare const isNavigationTarget: (value: unknown) => value is NavigationTarget;
export declare const qualifyNavigationTarget: (target: NavigationTarget, extensionId: string, projectId?: string) => NavigationTarget;
export declare const packageAsset: (path: string, baseUrl: string) => PackageAssetDescriptor;
interface ExternalRefInput {
  extensionId: string;
  id: string;
}
interface ExtensionOwner {
  publisher: string;
  name: string;
}
interface CommandRefFactory {
  <TParams extends Struct = Struct, TResult = unknown>(input: ExternalRefInput): CommandRef<TParams, TResult>;
  forExtension(owner: ExtensionOwner): <TParams extends Struct = Struct, TResult = unknown>(id: string) => CommandRef<TParams, TResult>;
}
export declare const commandRef: CommandRefFactory;
export declare const eventRef: <TPayload extends Struct = Struct>(input: ExternalRefInput) => EventRef<TPayload>;
export declare const defineSlot: <TContext extends Struct = Struct, TKind extends UiSlotKind = UiSlotKind>(id: string, options: SlotOptions<TKind>) => SlotRef<TContext, TKind>;
interface OrderedHistoryMerge<T> {
  key: (item: T) => string;
  merge: (known: T, native: T) => T;
  refineKey?: (known: T[], native: T[]) => (item: T) => string;
  time?: (item: T) => number | undefined;
  covered?: (item: T) => boolean;
}
export declare const mergeOrderedHistory: <T>(known: T[], native: T[], options: OrderedHistoryMerge<T>, trailing?: boolean) => T[];
type HistoryRecoveryResult = {
  kind: "recovered";
  messages: SessionMessage[];
} | {
  kind: "conflict";
  category: string;
};
interface HistoryRecoveryInput {
  knownMessages: readonly SessionMessage[];
  nativeMessages: readonly SessionMessage[];
}
interface HistoryProjection {
  key?: (message: SessionMessage) => string;
  merge?: (known: SessionMessage, native: SessionMessage) => SessionMessage;
  isGenerated?: (message: SessionMessage) => boolean;
}
export declare class HistoryConflict extends Error {}
export declare const submittedPrompt: (message: SessionMessage) => string;
export declare const historyValueKey: (value: unknown) => string;
export declare const historyMessageKey: (message: SessionMessage) => string;
export declare const splitHistoryTurns: (messages: readonly SessionMessage[]) => SessionMessage[][];
export declare const mergeHistoryMetadata: (known: SessionMessage, native: SessionMessage) => {
  parts: SessionMessagePart[];
  id: string;
  role: SessionMessageRole;
  index?: number;
  createdAt?: number;
  modelId?: string;
  providerId?: string;
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: {
      read?: number;
      write?: number;
    };
  };
};
export declare const reconcileMessageHistory: (input: HistoryRecoveryInput, projection?: HistoryProjection) => {
  kind: "recovered";
  messages: SessionMessage[];
  category?: undefined;
} | {
  kind: "conflict";
  category: string;
  messages?: undefined;
};
export declare const SDK_VERSION: string;
type CommandResponse<TResult = unknown> = {
  outcome: CommandOutcome<TResult>;
};
export declare const unwrapCommandOutcome: <TResult>(response: CommandResponse<TResult>, fallbackReason?: string) => TResult;
type CommandContribution<TSchema extends ParamObjectSchema | undefined, TResult> = CommandDefinition<TSchema, TResult> & ContributionDefinition<"command">;
type CommandInput<TSchema extends ParamObjectSchema | undefined, TResult> = Omit<CommandDefinition<TSchema, TResult>, "ref">;
export declare function defineCommand<const TSchema extends ParamObjectSchema | undefined = undefined, TResult = unknown>(definition: CommandInput<TSchema, TResult>): CommandContribution<TSchema, TResult>;
export declare const defineMiddleware: <TParams extends Struct = Struct, TResult = unknown>(definition: Omit<MiddlewareDefinition<TParams, TResult>, "ref">) => MiddlewareDefinition<TParams, TResult>;
export declare const defineHook: <TPayload extends Struct = Struct>(definition: Omit<HookDefinition<TPayload>, "ref">) => HookDefinition<TPayload>;
type ExactOptions<Definition, Contract> = unknown extends Contract ? Definition : [Contract] extends [Definition] ? Definition : Contract extends unknown ? Definition extends Contract ? Contract extends EventRef | CommandRef ? Definition : Definition extends ((...args: never[]) => unknown) ? Definition : Definition extends readonly unknown[] ? Contract extends readonly (infer Item)[] ? { [Index in keyof Definition]: ExactOptions<Definition[Index], Item>; } : never : Definition extends object ? { [Key in keyof Definition]: Key extends keyof Contract ? ExactOptions<Definition[Key], Contract[Key]> : never; } : Definition : never : never;
type NoExtraFields$1<Definition, Contract> = Definition & ExactOptions<Definition, Contract>;
type ViewDefinition = Omit<ViewContribution, "ref">;
export declare const defineView: <const Definition extends ViewDefinition>(definition: NoExtraFields$1<Definition, ViewDefinition>) => Definition & ContributionDefinition<"view">;
type ViewMenuDefinition = Omit<ViewMenuContribution, "ref">;
export declare const defineViewMenu: <const Definition extends ViewMenuDefinition>(definition: NoExtraFields$1<Definition, ViewMenuDefinition>) => Definition & ContributionDefinition<"view-menu">;
type PlacementDefinition = Omit<PlacementContribution, "ref">;
export declare const definePlacement: <const Definition extends PlacementDefinition>(definition: NoExtraFields$1<Definition, PlacementDefinition>) => Definition & ContributionDefinition<"placement">;
type ResourceKindDefinitionInput = Omit<ResourceKindDefinition, "ref">;
export declare const defineResourceKind: <const Definition extends ResourceKindDefinitionInput>(definition: NoExtraFields$1<Definition, ResourceKindDefinitionInput>) => Definition & ContributionDefinition<"resource-kind">;
export declare const resourceMenuSlotRef: (resourceKind: ResourceKindRef, id: string) => SlotRef<object, "menu">;
type NavigationItemDefinition = Omit<NavigationItemContribution, "ref">;
export declare const defineNavigationItem: <const Definition extends NavigationItemDefinition>(definition: NoExtraFields$1<Definition, NavigationItemDefinition>) => Definition & ContributionDefinition<"navigation-item">;
type NavigationTreeDefinition = Omit<NavigationTreeContribution, "ref">;
export declare const defineNavigationTree: <const Definition extends NavigationTreeDefinition>(definition: NoExtraFields$1<Definition, NavigationTreeDefinition>) => Definition & ContributionDefinition<"navigation-tree">;
type ModeDefinition = Omit<ModeContribution, "ref">;
export declare const defineMode: <const Definition extends ModeDefinition>(definition: NoExtraFields$1<Definition, ModeDefinition>) => Definition & ContributionDefinition<"mode">;
type PagePanelRefs<Slots extends readonly PageSlot[]> = { readonly [Id in Slots[number]["id"]]: PageSlotRef; };
type PageDefinition = Omit<PageContribution, "ref" | "panels">;
type RequiredPageParent<Definition extends PageDefinition> = Definition extends {
  resource: unknown;
  main: {
    kind: "view";
  };
} ? {
  readonly parent: PageRef;
} : unknown;
type RequiredPageResource<Definition extends PageDefinition> = Definition extends {
  main: {
    kind: "view";
    cardinality: "many";
  };
} ? {
  readonly resource: NonNullable<PageDefinition["resource"]>;
} : unknown;
export declare const definePage: <const Definition extends PageDefinition>(definition: NoExtraFields$1<Definition, PageDefinition> & RequiredPageParent<Definition> & RequiredPageResource<Definition>) => Definition & ContributionDefinition<"page"> & {
  readonly panels: PagePanelRefs<Definition["slots"]>;
};
export declare const defineStatusBarItem: <Definition extends Omit<StatusBarItemContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"status-bar-item">;
export declare const defineStatuses: <Definition extends Omit<StatusContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"status">;
export declare const defineSettingsPanel: <Definition extends Omit<SettingsPanelContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"settings-panel">;
export declare const defineActivityItem: <Definition extends Omit<ActivityItemContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"activity-item">;
export declare const defineSettingsSection: <Definition extends Omit<SettingsSectionContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"settings-section">;
export declare const defineCommandPaletteResource: <Definition extends Omit<CommandPaletteResourceContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"command-palette-resource">;
export declare const defineKeybinding: <Definition extends Omit<KeybindingContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"keybinding">;
export declare const defineSchedule: <Definition extends Omit<ScheduleContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"schedule">;
export declare const defineArtifactMount: <Definition extends Omit<ArtifactMountContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"artifact-mount">;
export declare const defineTemplateType: <Definition extends Omit<TemplateTypeContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"template-type">;
export declare const defineTemplate: <Definition extends Omit<TemplateContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"template">;
export declare const defineSkill: <Definition extends Omit<SkillContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"skill">;
export declare const defineTheme: <Definition extends Omit<ThemeContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"theme">;
export declare const defineFileIconTheme: <Definition extends Omit<FileIconThemeContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"file-icon-theme">;
export declare const defineWorkspaceType: <Definition extends Omit<WorkspaceTypeProvider, "ref">>(definition: Definition) => Definition & ContributionDefinition<"workspace-type">;
export declare const defineHarness: <Definition extends Omit<HarnessProvider, "ref">>(definition: Definition) => Definition & ContributionDefinition<"harness">;
export declare const defineConnection: <Definition extends Omit<ExtensionConnectionContribution, "ref">>(definition: Definition) => Definition & ContributionDefinition<"connection">;
export declare const defineResourceHierarchyProvider: (definition: Omit<ResourceHierarchyProvider, "ref">) => {
  ref: {
    kind: "resource-hierarchy-provider";
    id: string;
  };
  id: string;
  resourceKind: ResourceKindRef;
  parent: (ctx: ExtensionContextBase, resource: ResourceRef) => MaybePromise<ResourceRef | ViewHierarchyParent | null>;
};
type SettingValue<TProperty> = TProperty extends {
  type: "boolean";
} ? boolean : TProperty extends {
  type: "number";
} ? number : TProperty extends {
  type: "string";
} ? string : TProperty extends {
  type: "array";
} ? unknown[] : TProperty extends {
  type: "object";
} ? Record<string, unknown> : unknown;
type SettingsMap<TSettings> = TSettings extends {
  properties: infer TProperties extends Record<string, ExtensionSettingProperty>;
} ? { [K in keyof TProperties & string]: SettingValue<TProperties[K]>; } : Record<string, never>;
type NoExtraFields<Definition, Contract> = Definition & Record<Exclude<keyof Definition, keyof Contract>, never>;
export declare const defineExtension: <const TDefinition extends ExtensionDefinition>(extension: NoExtraFields<TDefinition, ExtensionDefinition>) => NoExtraFields<TDefinition, ExtensionDefinition>;
interface GuestHost {
  call<Capability extends WebviewHostCapability, const Params extends WebviewHostCapabilityParams[Capability] = WebviewHostCapabilityParams[Capability]>(method: Capability, ...args: Record<string, never> extends WebviewHostCapabilityParams[Capability] ? [params?: Params] : [params: Params]): Promise<WebviewHostCapabilityResult<Capability, Params>>;
  onEvent(scope: string, handler: (payload: unknown) => void): () => void;
  extensionId?: string;
}
type PropsStore<TProps = unknown> = {
  get: () => TProps;
  subscribe: (listener: (props: TProps) => void) => () => void;
};
interface WebviewFilesClient {
  pick(opts?: {
    accept?: string;
    multiple?: boolean;
  }): Promise<File[]>;
  upload(input: {
    name: string;
    data: Uint8Array | ArrayBuffer;
    mimeType?: string;
    scope?: {
      type: string;
      id?: string;
    };
  }): Promise<ExtensionBlobRef>;
  list(input?: {
    scope?: {
      type: string;
      id?: string;
    };
  }): Promise<ExtensionBlobRef[]>;
  delete(id: string): Promise<void>;
}
type ExtensionViewRenderContext<TProps = unknown> = {
  mount: HTMLElement;
  host: GuestHost;
  files: WebviewFilesClient;
  propsStore: PropsStore<TProps>;
  locale: string;
  t: (key: string, defaultValue?: string, args?: Record<string, unknown>) => string;
};
type ExtensionViewRender<TProps = unknown> = (context: ExtensionViewRenderContext<TProps>) => void | (() => void) | Promise<void | (() => void)>;
type ExtensionViewModule<TProps = unknown> = {
  mount: (mount: HTMLElement, host: GuestHost, propsStore: PropsStore<TProps>) => Promise<() => void> | (() => void) | void;
};
export declare const defineExtensionView: <TProps = unknown>(definition: {
  render: ExtensionViewRender<TProps>;
}) => ExtensionViewModule<TProps>;
export declare const resolveEventReferenceId: (ref: RendererEventReference, ownerExtensionId?: string) => string;
interface PageUrlDefinition {
  id: string;
  ref: PageRef;
  path: string;
}
interface PageResourceCodec {
  normalize(resource: ResourceRef): ResourceRef;
  toUri(resource: ResourceRef): string;
  fromUri(uri: string): ResourceRef | undefined;
}
export declare const serializeWorkbenchPageUrl: (input: {
  projectId: string;
  location: PageLocation;
  pages: readonly PageUrlDefinition[];
  resources: PageResourceCodec;
}) => string;
export declare const isWorkbenchProjectUrl: (urlValue: string, projectId: string) => boolean;
interface ParsedWorkbenchPageUrl {
  pageId: string;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
}
export declare const parseWorkbenchPageUrl: (input: {
  url: string;
  projectId: string;
  pages: readonly PageUrlDefinition[];
  resources: PageResourceCodec;
}) => ParsedWorkbenchPageUrl | undefined;
export declare const serializePageUrl: (input: {
  projectId: string;
  page: PageUrlDefinition;
  resource?: ResourceRef;
}) => string;
export declare const parsePageUrl: (input: {
  url: string;
  projectId: string;
  pages: readonly PageUrlDefinition[];
}) => ParsedWorkbenchPageUrl | undefined;
export declare const defaultPageResourceCodec: PageResourceCodec;
type RequiredOf<TOptions> = TOptions extends {
  required: infer TRequired extends boolean;
} ? TRequired : undefined;
type ParamOptions<TParam extends {
  type: string;
}> = Omit<TParam, "type">;
type SelectionOptions<TOptions> = TOptions extends ParamOption[] ? ParamOption[] : ParamOptionSource;
export declare const params: {
  valueOf: (key: string) => {
    kind: "param-value";
    key: string;
  };
  text: <const TOptions extends ParamOptions<TextParam> | undefined = undefined>(options?: TOptions) => TextParam<RequiredOf<TOptions>>;
  longText: <const TOptions extends ParamOptions<LongTextParam> | undefined = undefined>(options?: TOptions) => LongTextParam<RequiredOf<TOptions>>;
  markdown: <const TOptions extends ParamOptions<MarkdownParam> | undefined = undefined>(options?: TOptions) => MarkdownParam<RequiredOf<TOptions>>;
  files: <const TOptions extends ParamOptions<FilesParam> | undefined = undefined>(options?: TOptions) => FilesParam<RequiredOf<TOptions>>;
  number: <const TOptions extends ParamOptions<NumberParam> | undefined = undefined>(options?: TOptions) => NumberParam<RequiredOf<TOptions>>;
  boolean: <const TOptions extends ParamOptions<BooleanParam> | undefined = undefined>(options?: TOptions) => BooleanParam<RequiredOf<TOptions>>;
  select: <const TOptions extends ParamOptions<SelectParam>>(options: TOptions) => Omit<SelectParam<RequiredOf<TOptions>>, "options"> & {
    options: SelectionOptions<TOptions["options"]>;
  };
  multiSelect: <const TOptions extends ParamOptions<MultiSelectParam>>(options: TOptions) => Omit<MultiSelectParam<RequiredOf<TOptions>>, "options"> & {
    options: SelectionOptions<TOptions["options"]>;
  };
  harness: <const TOptions extends ParamOptions<HarnessParam> | undefined = undefined>(options?: TOptions) => HarnessParam<RequiredOf<TOptions>>;
  workspace: <const TOptions extends ParamOptions<WorkspaceParam> | undefined = undefined>(options?: TOptions) => WorkspaceParam<RequiredOf<TOptions>>;
  template: <const TOptions extends Omit<TemplateParam, "type" | "templateType"> & {
    type: string;
  }>(options: TOptions) => TemplateParam<RequiredOf<TOptions>>;
  resource: <const TOptions extends ParamOptions<ResourceParam>>(options: TOptions) => ResourceParam<RequiredOf<TOptions>>;
  json: <T = unknown, const TOptions extends ParamOptions<JsonParam<T>> | undefined = undefined>(options?: TOptions) => JsonParam<T, RequiredOf<TOptions>>;
  list: <const TOptions extends ParamOptions<ListParam> | undefined = undefined>(options?: TOptions) => ListParam<RequiredOf<TOptions>>;
};
type QualifiableRef = ContributionRef<ContributionKind> | PageSlotRef;
type QualifiedRef<Ref extends QualifiableRef> = Ref extends PageSlotRef ? Omit<Ref, "page"> & {
  readonly page: QualifiedRef<Ref["page"]>;
} : Ref & {
  readonly extensionId: string;
};
export declare function qualifyRef<Ref extends QualifiableRef>(owner: string, ref: Ref): QualifiedRef<Ref>;
export declare const commandEvent: <TPhase extends CommandLifecyclePhase, TParams extends Struct = Struct, TResult = unknown>(command: CommandRef<TParams, TResult>, phase: TPhase) => EventRef<CommandLifecycleEventPayload<TPhase, TParams, TResult>>;
export declare function resourceKey(resource: ResourceRef): string;
export declare function resourceKey(resource: ResourceRef | undefined): string | undefined;
interface TerminalSessionRequest$1 {
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols: number;
  rows: number;
}
interface TerminalSessionExit {
  code: number | null;
  signal: string | null;
}
interface TerminalSessionAdapter {
  readonly id: string;
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): Promise<void>;
  onData(handler: (chunk: Uint8Array) => void): () => void;
  onExit(handler: (exit: TerminalSessionExit) => void): () => void;
  onError(handler: (error: {
    message: string;
  }) => void): () => void;
}
interface TerminalSessionBridge {
  openSession(request: TerminalSessionRequest$1): Promise<TerminalSessionAdapter>;
}
export declare const createTerminalSessionBridge: (host: GuestHost) => TerminalSessionBridge;
type ArtifactMountKey = string | {
  id: string;
};
export declare const artifactMountId: (mount: ArtifactMountKey) => string;
export declare const artifactsRead: (mount: ArtifactMountKey) => WebviewCapabilityDeclaration;
export declare const EXTENSION_EVENTS_SCOPE = "extension.events";
type WebviewExtensionEvent = {
  type: "changed";
  id: string;
} | {
  type: "reset";
};
interface WebviewEventsClient {
  subscribe(event: RendererEventReference, listener: () => void): () => void;
}
type CommandFn<TDefinition> = TDefinition extends CommandDefinition<infer TSchema, infer TResult, infer _TSettings> ? TSchema extends ParamObjectSchema ? Partial<ParamsOf<TSchema>> extends ParamsOf<TSchema> ? (params?: ParamsOf<TSchema>) => Promise<TResult> : (params: ParamsOf<TSchema>) => Promise<TResult> : () => Promise<TResult> : never;
type WebviewCommandsClient<TCommands> = { [K in keyof TCommands & string]: CommandFn<TCommands[K]>; };
type WebviewSettingsClient<TSettings> = {
  all: () => Promise<Partial<TSettings>>;
  get: <K extends keyof TSettings & string>(key: K) => Promise<TSettings[K] | undefined>;
  set: <K extends keyof TSettings & string>(key: K, value: TSettings[K]) => Promise<void>;
};
type ClientSettingsMap<TSettings> = TSettings extends {
  properties: unknown;
} ? SettingsMap<TSettings> : Record<never, never>;
type WebviewArtifactsClient = {
  list: (mount: ArtifactMountKey, prefix?: string) => Promise<WebviewArtifactFile[]>;
  readText: (mount: ArtifactMountKey, path: string) => Promise<string>;
  imageUrl: (mount: ArtifactMountKey, path: string) => Promise<string>;
};
type WebviewClient<TCommands, TSettings = undefined> = {
  artifacts: WebviewArtifactsClient;
  commands: WebviewCommandsClient<TCommands>;
  events: WebviewEventsClient;
  settings: WebviewSettingsClient<ClientSettingsMap<TSettings>>;
};
interface WebviewClientOptions {
  extensionId?: string;
  workspaceId?: string;
}
export declare const createWebviewClient: <TCommands extends object, TSettings = undefined>(host: GuestHost, options?: WebviewClientOptions) => WebviewClient<TCommands, TSettings>;
export declare const matchesResourceWhen: (when: Pick<WhenExpression, "resourceType"> | {
  resourceType?: readonly string[];
} | undefined, resourceType: string | undefined) => boolean;
export declare const projectPrefix: () => {
  $prefix: "project";
};
export type { ActionOption, ActionsControl, ActivityItemContribution, AgentCapability, AgentModel, AnchorGridControl, AnchorGridValue, ApprovalRequest, ApprovalResponse, ArtifactFile, ArtifactMount, ArtifactMountContribution, ArtifactMountKey, AssetContributions, AutomationRun, AutomationRunStatus, BaseControl, BehaviourContributions, BooleanControl, BooleanParam, CliContribution, CollectionBadgeItem, ColorControl, CommandCompletedEvent, CommandContext, CommandContinue, CommandDefinition, CommandDiagnostic, CommandFailedEvent, CommandHelpersApi, CommandInvocation, CommandLifecycleEventPayload, CommandLifecyclePhase, CommandMiddlewareContext, CommandMiddlewareHandler, CommandMiddlewareResult, CommandNotice, CommandOutcome, CommandPaletteContribution, CommandPaletteResourceContribution, CommandPaletteResourceItem, CommandPaletteResourceQueryParams, CommandPaletteResourceQueryResult, CommandPaletteResourceTarget, CommandPatchParams, CommandRef, CommandReject, CommandRejectedEvent, CommandReplaceInvocation, CommandReplaceParams, CommandRequestedEvent, CommandResponse, CommandRunHandler, CommandSource, CommandStartedEvent, CommandTarget, CommitPayload, ConflictPayload, ConnectionRef, ContributionDefinition, ContributionInput, ContributionKind, ContributionRef, ControlGroup, ControlParam, ControlValue, ControlValueMap, ControlsApplyInput, ControlsQueryParams, ControlsQueryResult, ControlsRendererContribution, ControlsResetInput, ControlsResourceRef, ControlsUpdateValueInput, ControlsViewBody, CreateExtensionWorkspaceInput, CreateNotificationInput, CreateWorkspaceCommandParams, DataTableRendererColumn, DataTableRendererColumnRenderer, DataTableRendererColumnStat, DataTableRendererContribution, DataTableRendererQueryParams, DataTableRendererQueryResult, DataTableRendererResourceRef, DataTableRendererRow, DataTableRendererRowAction, DataTableRendererRowActivationHandler, DataTableRendererSavedView, DataTableRendererSelectionAction, DataTableRendererSettings, DataTableRendererThemeColor, DataTableViewBody, DateControl, DockedWorkbenchRegion, ErrorPart, EventContext, EventDeliveryResult, EventRef, ExtensionActivityApi, ExtensionArtifactApi, ExtensionAutomationApi, ExtensionBlobInput, ExtensionBlobRef, ExtensionBlobsApi, ExtensionConnectionContribution, ExtensionConnectionMethod, ExtensionConnectionRequest, ExtensionConnectionResponse, ExtensionConnectionStreamEvent, ExtensionConnectionsApi, ExtensionContextBase, ExtensionDefinition, ExtensionEventsApi, ExtensionFilesApi, ExtensionHarnessInput, ExtensionLoadScope, ExtensionLoggerApi, ExtensionNetApi, ExtensionNotifyApi, ExtensionPackageFilesApi, ExtensionPanelRegion, ExtensionProcessApi, ExtensionProjectContext, ExtensionResourcesApi, ExtensionSessionResource, ExtensionSessionsApi, ExtensionSettingProperty, ExtensionSettingScope, ExtensionSettingValueForType, ExtensionSettingValueType, ExtensionSettingsApi, ExtensionSettingsContribution, ExtensionSkillsApi, ExtensionSourceKind, ExtensionStorageApi, ExtensionStorageCollectionApi, ExtensionTerminalApi, ExtensionViewModule, ExtensionViewRender, ExtensionViewRenderContext, ExtensionWorkspace, ExtensionWorkspaceProvider, ExtensionWorkspacesApi, FileIconThemeContribution, FilePart, FileRendererContribution, FileRendererLoadParams, FileRendererLoadResult, FileRendererResourceRef, FileRendererSaveParams, FileRendererSectionAnchor, FileRendererSectionTarget, FileViewBody, FilesParam, GuestHost, HarnessApprovalChannel, HarnessAttachment, HarnessContext, HarnessDetectionResult, HarnessEventSink, HarnessExit, HarnessExitStatus, HarnessMessagesInput, HarnessParam, HarnessParamDescriptor, HarnessParamValue, HarnessParams, HarnessParamsSchema, HarnessProvider, HarnessQuestion, HarnessQuestionChannel, HarnessQuestionOption, HarnessQuestionReplyError, HarnessQuestionRequest, HarnessReattachInput, HarnessRecoveryInput, HarnessRecoveryResult, HarnessResumeInput, HarnessSession, HarnessSkillsLayout, HarnessStartInput, HarnessStateApi, HistoryProjection, HistoryRecoveryInput, HistoryRecoveryResult, HookDefinition, JsonObject, JsonParam, JsonPatch, JsonPrimitive, JsonValue, KanbanRendererAttributeDescriptor, KanbanRendererAttributeDisplay, KanbanRendererAttributeType, KanbanRendererBoardColumnConfig, KanbanRendererColumnAction, KanbanRendererContribution, KanbanRendererCreateRowContribution, KanbanRendererEnumOption, KanbanRendererFilterState, KanbanRendererQueryParams, KanbanRendererQueryResult, KanbanRendererResourceRef, KanbanRendererRow, KanbanRendererRowAction, KanbanRendererRowActivationHandler, KanbanRendererSavedView, KanbanRendererSettings, KanbanRendererSortDirection, KanbanRendererViewMode, KanbanRendererViewSettings, KanbanViewBody, KeybindingChord, KeybindingContribution, ListNotificationsQuery, ListNotificationsResponse, ListParam, LoadingPart, LocalExtensionSource, Localizable, LocalizedString, LongTextParam, MarkdownControl, MarkdownParam, MaybePromise, MenuContribution, MergePayload, MiddlewareDefinition, MigrationContext, ModeContribution, ModeRef, ModeRegionSettings, MultiSelectParam, NavigationItemContribution, NavigationOwnerRef, NavigationTarget, NavigationTargetCommand, NavigationTargetCompound, NavigationTargetHref, NavigationTargetItem, NavigationTargetPage, NavigationTargetPanel, NavigationTreeContribution, NavigationTreeSlot, Notification, NotificationAction, NotificationActorType, NotificationKind, NotificationOrigin, NotificationPriority, NotificationStatus, NumberControl, NumberParam, PackageAssetDescriptor, PackageManifest, PageContribution, PageLocation, PageMain, PageMainPanels, PageMainView, PageOpenIntent, PageRef, PageSlot, PageSlotCardinality, PageSlotRef, PageSlotRegion, PageSlotRole, PageUrlDefinition, PanelRef, ParamDescriptor, ParamEditorReadOnlyContent, ParamEditorReadOnlyImage, ParamObjectSchema, ParamOption, ParamOptionSource, ParamType, ParamValue, ParamValueRef, ParamsOf, ParsedWorkbenchPageUrl, PatchPart, PlacementContribution, PlacementIdentity, PlacementItem, PlacementMountStrategy, PlacementOwner, PlacementPresence, PlacementPresentation, PlacementRef, PlacementTabMenuGroup, PlacementTabMenuRow, PlacementTabPresentation, PlacementTabSnapshot, ProcessRunInput, ProcessRunResult, PropsStore, ProviderContributions, QualifiedRef, QuestionResponse, RangeControl, RangeValue, ReadOnlyControl, ReasoningPart, RebasePayload, RegionSize, RendererCallback, RendererContext, RendererContributionBase, RendererEventReference, RendererInvocationContext, ResourceAnchor, ResourceBinding, ResourceConstraint, ResourceControl, ResourceHierarchyProvider, ResourceKindDefinition, ResourceKindRef, ResourceMenuSlotDefinition, ResourceOption, ResourceParam, ResourceRef, ResourceRefValue, ResourceRemovedEvent, ResourceRole, RetryableHarnessReattachError, ScheduleContribution, ScheduleExpression, SegmentedControl, SegmentedOption, SelectParam, SelectionControl, SelectionGroup, SelectionOption, SerializedError, SessionLifecyclePayload, SessionMessage, SessionMessagePart, SessionMessageRole, SettingsPanelContribution, SettingsSectionContribution, SettingsSectionRef, SettingsSlotRef, SetupContext, SkillContribution, SlotInvocationContext, SlotOptions, SlotRef, StatusActionDefinition, StatusBarItemContribution, StatusBarSlotRef, StatusContribution, StatusRef, StepFinishPart, StepStartPart, StorageScope, Struct, TemplateContribution, TemplateParam, TemplateTypeContribution, TerminalEvent, TerminalSessionAdapter, TerminalSessionBridge, TerminalSessionExit, TerminalSessionHandle, TerminalSessionRequest, TextControl, TextParam, TextPart, ThemeContribution, ThemeMode, ThemeRef, TimeoutStrategy, TokenUsagePart, ToolPart, ToolPartActionType, ToolPartStatus, TreeAction, TreeNode, TreeNodeRowVariant, TreeNodeTarget, TreeRendererActionParams, TreeRendererChildrenParams, TreeRendererCommandResult, TreeRendererContribution, TreeRendererQueryParams, TreeRendererResourceRef, TreeRendererState, TreeSectionEmptyState, TreeViewBody, TreeViewSection, UiContributions, UiSlotKind, UpdateNotificationInput, VectorControl, VectorValue, ViewBody, ViewContribution, ViewFieldKind, ViewFilterCondition, ViewFilterGroup, ViewFilterRule, ViewHierarchyParent, ViewMenuContribution, ViewRef, ViewSort, ViewSortDirection, ViewToolbarAction, WebviewArtifactFile, WebviewArtifactsClient, WebviewArtifactsReadParams, WebviewCapabilityDeclaration, WebviewClient, WebviewClientOptions, WebviewCommandsClient, WebviewCommandsExecuteParams, WebviewContribution, WebviewDeclarableCapability, WebviewEventsClient, WebviewExtensionEvent, WebviewExtensionSettingKeyParams, WebviewExtensionSettingSetParams, WebviewFileScope, WebviewFilesClient, WebviewFilesDeleteParams, WebviewFilesListParams, WebviewFilesUploadParams, WebviewHostCapability, WebviewHostCapabilityParams, WebviewHostCapabilityResult, WebviewHostCapabilityResults, WebviewKeyboardEventParams, WebviewNavigationOpenParams, WebviewNotificationActionParams, WebviewNotificationDismissParams, WebviewNotificationResolveParams, WebviewNotificationShowParams, WebviewPreferencesGetParams, WebviewPreferencesSetParams, WebviewScopedDeclarableCapability, WebviewSettingsClient, WebviewViewBody, WhenExpression, WorkbenchAttachmentInvocationContext, WorkflowStatus, WorkspaceCapabilities, WorkspaceExecutionTarget, WorkspaceFilesMount, WorkspaceParam, WorkspaceProviderCreateInput, WorkspaceProviderMutationInput, WorkspaceProviderRef, WorkspaceProviderResolveInput, WorkspaceProviderResult, WorkspaceProviderState, WorkspaceProvisionPayload, WorkspaceSyncFile, WorkspaceType, WorkspaceTypeProvider, WorktreeRemovedPayload, parseExtensionApiDeclaration, supportsExtensionApiVersion };
