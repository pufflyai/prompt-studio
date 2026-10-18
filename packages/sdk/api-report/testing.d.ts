import { z } from "zod";
declare const assetReferenceSchema: z.ZodObject<{
  sha256: z.ZodString;
  byteLength: z.ZodNumber;
  mediaType: z.ZodString;
}, z.core.$strict>;
type AssetReference = z.infer<typeof assetReferenceSchema>;
declare const assetTransferSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
  status: z.ZodLiteral<"staging">;
  operationId: z.ZodString;
  expected: z.ZodObject<{
    sha256: z.ZodString;
    byteLength: z.ZodNumber;
    mediaType: z.ZodString;
  }, z.core.$strict>;
  uploadedByteLength: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
  status: z.ZodLiteral<"complete">;
  operationId: z.ZodString;
  asset: z.ZodObject<{
    sha256: z.ZodString;
    byteLength: z.ZodNumber;
    mediaType: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  status: z.ZodLiteral<"cancelled">;
  operationId: z.ZodString;
  expected: z.ZodObject<{
    sha256: z.ZodString;
    byteLength: z.ZodNumber;
    mediaType: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>], "status">;
type AssetTransfer = z.infer<typeof assetTransferSchema>;
interface ExtensionAssetsApi {
  stage(input: {
    operationId: string;
    source: Blob;
  }): Promise<AssetReference>;
  getTransfer(operationId: string): Promise<AssetTransfer | undefined>;
  cancel(operationId: string): Promise<AssetTransfer | undefined>;
  read(asset: AssetReference): Promise<ReadableStream<Uint8Array>>;
  verifyComplete(assets: AssetReference[]): Promise<void>;
}
declare const workbenchMenuTargets: readonly ["workbench.nav.actions", "workbench.nav.overflow"];
declare const workbenchTreeTargets: readonly ["workbench.left.tree", "workbench.main.left.tree", "workbench.main.right.tree"];
declare const workbenchViewTargets: readonly ["workbench.main", "workbench.main.left", "workbench.main.right", "workbench.secondary"];
declare const workbenchSettingsTargets: readonly ["workbench.settings"];
type WorkbenchMenuTarget = (typeof workbenchMenuTargets)[number];
type WorkbenchTreeTarget = (typeof workbenchTreeTargets)[number];
type WorkbenchViewTarget = (typeof workbenchViewTargets)[number];
type WorkbenchSettingsTarget = (typeof workbenchSettingsTargets)[number];
type WorkbenchAttachmentTarget = WorkbenchMenuTarget | WorkbenchTreeTarget | WorkbenchViewTarget | WorkbenchSettingsTarget;
type ContributionKind = "activity-item" | "artifact-mount" | "command" | "command-palette-resource" | "connection" | "file-icon-theme" | "harness" | "hook" | "keybinding" | "middleware" | "mode" | "navigation-item" | "navigation-tree" | "page" | "placement" | "resource-hierarchy-provider" | "resource-kind" | "schedule" | "settings-panel" | "settings-section" | "skill" | "status-bar-item" | "template" | "template-type" | "theme" | "view" | "view-menu" | "workspace-type";
interface ContributionRef<Kind extends ContributionKind> {
  readonly extensionId?: string;
  readonly kind: Kind;
  readonly id: string;
}
type PageRef = ContributionRef<"page">;
type PlacementRef = ContributionRef<"placement">;
type ViewRef = ContributionRef<"view">;
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
type JsonObject = {
  [key: string]: JsonValue;
};
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
interface LocalizedString {
  readonly $l10n: string;
  readonly default?: string;
}
type Localizable<T extends string = string> = T | LocalizedString;
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
interface SlotInvocationContext<TContext extends Struct = Struct> {
  id: string;
  kind: UiSlotKind;
  context: TContext;
}
declare const queuedFollowUpSchema: z.ZodObject<{
  queuePosition: z.ZodNumber;
  revision: z.ZodString;
  prompt: z.ZodString;
  steeringUnavailableReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  steeringDelivery: z.ZodNullable<z.ZodObject<{
    id: z.ZodString;
    runStartedAt: z.ZodString;
  }, z.core.$strip>>;
  model: z.ZodNullable<z.ZodString>;
  params: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>;
  attachments: z.ZodArray<z.ZodObject<{
    file_id: z.ZodString;
  }, z.core.$strip>>;
}, z.core.$strip>;
declare const updateQueuedFollowUpInputSchema: z.ZodObject<{
  prompt: z.ZodString;
  expectedRevision: z.ZodOptional<z.ZodString>;
  model: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  params: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>>>;
  attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
    file_id: z.ZodString;
  }, z.core.$strip>>>;
}, z.core.$strip>;
declare const combineQueuedFollowUpsInputSchema: z.ZodObject<{
  sourcePosition: z.ZodNumber;
  sourceRevision: z.ZodString;
  targetRevision: z.ZodString;
}, z.core.$strip>;
declare const pendingQueuedFollowUpsResponseSchema: z.ZodObject<{
  requests: z.ZodArray<z.ZodObject<{
    queuePosition: z.ZodNumber;
    revision: z.ZodString;
    prompt: z.ZodString;
    steeringUnavailableReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    steeringDelivery: z.ZodNullable<z.ZodObject<{
      id: z.ZodString;
      runStartedAt: z.ZodString;
    }, z.core.$strip>>;
    model: z.ZodNullable<z.ZodString>;
    params: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>;
    attachments: z.ZodArray<z.ZodObject<{
      file_id: z.ZodString;
    }, z.core.$strip>>;
  }, z.core.$strip>>;
  activeRunStartedAt: z.ZodNullable<z.ZodString>;
  steeringAvailable: z.ZodBoolean;
  steeringUnavailableReason: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
type QueuedFollowUpRequest = z.infer<typeof queuedFollowUpSchema>;
type UpdateQueuedFollowUpInput = z.infer<typeof updateQueuedFollowUpInputSchema>;
type CombineQueuedFollowUpsInput = z.infer<typeof combineQueuedFollowUpsInputSchema>;
type PendingQueuedFollowUpsResponse = z.infer<typeof pendingQueuedFollowUpsResponseSchema>;
declare const steerQueuedFollowUpInputSchema: z.ZodObject<{
  expectedRevision: z.ZodString;
  expectedRunStartedAt: z.ZodString;
}, z.core.$strip>;
declare const queuedSteeringResultSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
  status: z.ZodLiteral<"accepted">;
  deliveryId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
  status: z.ZodLiteral<"rejected">;
  reason: z.ZodEnum<{
    blocking_input: "blocking_input";
    delivery_failed: "delivery_failed";
    different_settings: "different_settings";
    inactive: "inactive";
    invalid_attachments: "invalid_attachments";
    missing: "missing";
    stale_revision: "stale_revision";
    stale_run: "stale_run";
    unsupported: "unsupported";
  }>;
  message: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
  status: z.ZodLiteral<"uncertain">;
  deliveryId: z.ZodString;
  message: z.ZodString;
}, z.core.$strip>], "status">;
type SteerQueuedFollowUpInput = z.infer<typeof steerQueuedFollowUpInputSchema>;
type QueuedSteeringResult = z.infer<typeof queuedSteeringResultSchema>;
declare const sessionAttachmentRefSchema: z.ZodObject<{
  file_id: z.ZodString;
}, z.core.$strip>;
declare const sessionStatusSchema: z.ZodEnum<{
  awaiting_input: "awaiting_input";
  cancelled: "cancelled";
  completed: "completed";
  disconnected: "disconnected";
  failed: "failed";
  in_progress: "in_progress";
  queued: "queued";
}>;
type SessionStatus = z.infer<typeof sessionStatusSchema>;
type SessionAttachmentRef = z.infer<typeof sessionAttachmentRefSchema>;
type SessionExitCause = "completed" | "user_stop" | "request_aborted" | "worker_lost" | "host_shutdown" | "timeout" | "failed" | "unknown";
interface SessionRunSnapshot {
  status: string;
  startedAt: string | null;
  endedAt: string | null;
}
interface SessionExit {
  cause: SessionExitCause;
  startedAt: string | null;
  endedAt: string;
}
interface ExtensionSessionUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}
interface ExtensionSessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  archived: boolean;
  agent: string | null;
  last_selected_model: string | null;
  workspace_id: string | null;
  original_session_id: string | null;
  created_at: string;
  updated_at: string;
  last_request_started: string | null;
  last_request_ended: string | null;
  anchors_json: ResourceAnchor[];
  usage: ExtensionSessionUsage | null;
}
interface ExtensionSessionQuery {
  status?: SessionStatus[];
  agent?: string;
  workspaceId?: string;
  anchor?: Pick<ResourceRef, "type" | "id">;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
}
interface ExtensionSessionPage {
  items: ExtensionSessionSummary[];
  nextCursor: string | null;
}
interface ExtensionSessionResource {
  type: "session";
  id: string;
  title: string;
  status: SessionStatus;
  agent?: string | null;
}
interface ExtensionSessionsApi {
  getQueuedFollowUps(sessionId: string): Promise<PendingQueuedFollowUpsResponse>;
  updateQueuedFollowUp(sessionId: string, queuePosition: number, input: UpdateQueuedFollowUpInput): Promise<QueuedFollowUpRequest>;
  combineQueuedFollowUps(sessionId: string, queuePosition: number, input: CombineQueuedFollowUpsInput): Promise<QueuedFollowUpRequest>;
  steerQueuedFollowUp(sessionId: string, queuePosition: number, input: SteerQueuedFollowUpInput): Promise<QueuedSteeringResult>;
  get(id: string): Promise<{
    id: string;
    title: string;
    status?: string;
    last_exit?: SessionExit | null;
    original_session_id?: string | null;
    cwd?: string | null;
    updated_at?: string | null;
    anchors_json?: ResourceAnchor[];
    archived?: boolean;
    agent?: string | null;
    last_selected_model?: string | null;
    workspace_id?: string | null;
    created_at?: string | null;
    last_request_started?: string | null;
    last_request_ended?: string | null;
    usage?: ExtensionSessionUsage | null;
  } | null>;
  query(input?: ExtensionSessionQuery): Promise<ExtensionSessionPage>;
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
    expectedRun?: SessionRunSnapshot;
  }): Promise<void>;
  addAnchors(sessionId: string, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(sessionId: string, refs: ResourceRef[]): Promise<void>;
}
interface ExtensionHarnessInput {
  harnessId: string;
  model?: string;
  params?: Record<string, string | boolean>;
}
type PageParamValue = string | number | boolean | readonly string[];
type PageParams = Readonly<Record<string, PageParamValue>>;
type PageOpenIntent = "preview" | "pin";
interface PageSlotRef {
  readonly kind: "page-slot";
  readonly page: PageRef;
  readonly id: string;
}
type PanelRef = PlacementRef | PageSlotRef;
interface FileSourcePosition {
  readonly line: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
}
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
interface ResourceAnchorQuery {
  resource: ResourceRef;
  direction?: "outgoing" | "incoming" | "both";
  role?: ResourceRole;
  cursor?: string;
  limit?: number;
}
interface ResourceAnchorPage {
  items: Array<{
    source: ResourceRef;
    target: ResourceAnchor;
  }>;
  nextCursor?: string;
}
interface ExtensionResourcesApi {
  addAnchors(resource: ResourceRef, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(resource: ResourceRef, refs: ResourceRef[]): Promise<void>;
  listAnchors(input: ResourceAnchorQuery): Promise<ResourceAnchorPage>;
  removed(resource: ResourceRef): Promise<void>;
  allocate(input: {
    kind: string;
  }): Promise<{
    id: string;
    shorthand: string;
  }>;
}
interface ResourceAnchor extends ResourceRef {
  role?: ResourceRole;
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
declare const skillSchema: z.ZodObject<{
  id: z.ZodString;
  project_id: z.ZodString;
  name: z.ZodString;
  title: z.ZodString;
  description: z.ZodString;
  source_kind: z.ZodEnum<{
    extension: "extension";
    project: "project";
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
declare const boardViewSchema: z.ZodObject<{
  id: z.ZodString;
  boardId: z.ZodString;
  title: z.ZodString;
  settings: z.ZodUnion<readonly [z.ZodObject<{
    viewMode: z.ZodEnum<{
      board: "board";
      list: "list";
    }>;
    columnGrouping: z.ZodString;
    rowGrouping: z.ZodString;
    displayProperties: z.ZodArray<z.ZodString>;
  }, z.core.$strip>, z.ZodObject<{
    grouping: z.ZodString;
    rowNumbers: z.ZodBoolean;
    wrapRows: z.ZodBoolean;
    showStats: z.ZodBoolean;
    hiddenColumns: z.ZodArray<z.ZodString>;
    columnOrder: z.ZodArray<z.ZodString>;
  }, z.core.$strip>]>;
  filter: z.ZodObject<{
    conjunction: z.ZodEnum<{
      and: "and";
      or: "or";
    }>;
    rules: z.ZodArray<z.ZodObject<{
      attributeId: z.ZodString;
      condition: z.ZodEnum<{
        contains: "contains";
        "does-not-contain": "does-not-contain";
        gt: "gt";
        gte: "gte";
        "has-all-of": "has-all-of";
        "has-any-of": "has-any-of";
        "has-none-of": "has-none-of";
        is: "is";
        "is-after": "is-after";
        "is-any-of": "is-any-of";
        "is-before": "is-before";
        "is-empty": "is-empty";
        "is-none-of": "is-none-of";
        "is-not": "is-not";
        "is-not-empty": "is-not-empty";
        "is-on-or-after": "is-on-or-after";
        "is-on-or-before": "is-on-or-before";
        lt: "lt";
        lte: "lte";
      }>;
      value: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
      conjunction: z.ZodEnum<{
        and: "and";
        or: "or";
      }>;
      rules: z.ZodArray<z.ZodObject<{
        attributeId: z.ZodString;
        condition: z.ZodEnum<{
          contains: "contains";
          "does-not-contain": "does-not-contain";
          gt: "gt";
          gte: "gte";
          "has-all-of": "has-all-of";
          "has-any-of": "has-any-of";
          "has-none-of": "has-none-of";
          is: "is";
          "is-after": "is-after";
          "is-any-of": "is-any-of";
          "is-before": "is-before";
          "is-empty": "is-empty";
          "is-none-of": "is-none-of";
          "is-not": "is-not";
          "is-not-empty": "is-not-empty";
          "is-on-or-after": "is-on-or-after";
          "is-on-or-before": "is-on-or-before";
          lt: "lt";
          lte: "lte";
        }>;
        value: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString>]>>;
      }, z.core.$strip>>;
    }, z.core.$strict>>>;
  }, z.core.$strict>;
  sorts: z.ZodArray<z.ZodObject<{
    attributeId: z.ZodString;
    direction: z.ZodEnum<{
      asc: "asc";
      desc: "desc";
    }>;
  }, z.core.$strip>>;
  builtIn: z.ZodBoolean;
}, z.core.$strip>;
declare const boardViewsSchema: z.ZodObject<{
  views: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    boardId: z.ZodString;
    title: z.ZodString;
    settings: z.ZodUnion<readonly [z.ZodObject<{
      viewMode: z.ZodEnum<{
        board: "board";
        list: "list";
      }>;
      columnGrouping: z.ZodString;
      rowGrouping: z.ZodString;
      displayProperties: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      grouping: z.ZodString;
      rowNumbers: z.ZodBoolean;
      wrapRows: z.ZodBoolean;
      showStats: z.ZodBoolean;
      hiddenColumns: z.ZodArray<z.ZodString>;
      columnOrder: z.ZodArray<z.ZodString>;
    }, z.core.$strip>]>;
    filter: z.ZodObject<{
      conjunction: z.ZodEnum<{
        and: "and";
        or: "or";
      }>;
      rules: z.ZodArray<z.ZodObject<{
        attributeId: z.ZodString;
        condition: z.ZodEnum<{
          contains: "contains";
          "does-not-contain": "does-not-contain";
          gt: "gt";
          gte: "gte";
          "has-all-of": "has-all-of";
          "has-any-of": "has-any-of";
          "has-none-of": "has-none-of";
          is: "is";
          "is-after": "is-after";
          "is-any-of": "is-any-of";
          "is-before": "is-before";
          "is-empty": "is-empty";
          "is-none-of": "is-none-of";
          "is-not": "is-not";
          "is-not-empty": "is-not-empty";
          "is-on-or-after": "is-on-or-after";
          "is-on-or-before": "is-on-or-before";
          lt: "lt";
          lte: "lte";
        }>;
        value: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString>]>>;
      }, z.core.$strip>>;
      groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        conjunction: z.ZodEnum<{
          and: "and";
          or: "or";
        }>;
        rules: z.ZodArray<z.ZodObject<{
          attributeId: z.ZodString;
          condition: z.ZodEnum<{
            contains: "contains";
            "does-not-contain": "does-not-contain";
            gt: "gt";
            gte: "gte";
            "has-all-of": "has-all-of";
            "has-any-of": "has-any-of";
            "has-none-of": "has-none-of";
            is: "is";
            "is-after": "is-after";
            "is-any-of": "is-any-of";
            "is-before": "is-before";
            "is-empty": "is-empty";
            "is-none-of": "is-none-of";
            "is-not": "is-not";
            "is-not-empty": "is-not-empty";
            "is-on-or-after": "is-on-or-after";
            "is-on-or-before": "is-on-or-before";
            lt: "lt";
            lte: "lte";
          }>;
          value: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
      }, z.core.$strict>>>;
    }, z.core.$strict>;
    sorts: z.ZodArray<z.ZodObject<{
      attributeId: z.ZodString;
      direction: z.ZodEnum<{
        asc: "asc";
        desc: "desc";
      }>;
    }, z.core.$strip>>;
    builtIn: z.ZodBoolean;
  }, z.core.$strip>>;
  defaultViewId: z.ZodString;
}, z.core.$strip>;
declare const boardViewUpdateSchema: z.ZodObject<{
  title: z.ZodOptional<z.ZodString>;
  settings: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
    viewMode: z.ZodOptional<z.ZodEnum<{
      board: "board";
      list: "list";
    }>>;
    columnGrouping: z.ZodOptional<z.ZodString>;
    rowGrouping: z.ZodOptional<z.ZodString>;
    displayProperties: z.ZodOptional<z.ZodArray<z.ZodString>>;
  }, z.core.$strict>, z.ZodObject<{
    grouping: z.ZodOptional<z.ZodString>;
    rowNumbers: z.ZodOptional<z.ZodBoolean>;
    wrapRows: z.ZodOptional<z.ZodBoolean>;
    showStats: z.ZodOptional<z.ZodBoolean>;
    hiddenColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
    columnOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
  }, z.core.$strict>]>>;
  filter: z.ZodOptional<z.ZodObject<{
    conjunction: z.ZodEnum<{
      and: "and";
      or: "or";
    }>;
    rules: z.ZodArray<z.ZodObject<{
      attributeId: z.ZodString;
      condition: z.ZodEnum<{
        contains: "contains";
        "does-not-contain": "does-not-contain";
        gt: "gt";
        gte: "gte";
        "has-all-of": "has-all-of";
        "has-any-of": "has-any-of";
        "has-none-of": "has-none-of";
        is: "is";
        "is-after": "is-after";
        "is-any-of": "is-any-of";
        "is-before": "is-before";
        "is-empty": "is-empty";
        "is-none-of": "is-none-of";
        "is-not": "is-not";
        "is-not-empty": "is-not-empty";
        "is-on-or-after": "is-on-or-after";
        "is-on-or-before": "is-on-or-before";
        lt: "lt";
        lte: "lte";
      }>;
      value: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
      conjunction: z.ZodEnum<{
        and: "and";
        or: "or";
      }>;
      rules: z.ZodArray<z.ZodObject<{
        attributeId: z.ZodString;
        condition: z.ZodEnum<{
          contains: "contains";
          "does-not-contain": "does-not-contain";
          gt: "gt";
          gte: "gte";
          "has-all-of": "has-all-of";
          "has-any-of": "has-any-of";
          "has-none-of": "has-none-of";
          is: "is";
          "is-after": "is-after";
          "is-any-of": "is-any-of";
          "is-before": "is-before";
          "is-empty": "is-empty";
          "is-none-of": "is-none-of";
          "is-not": "is-not";
          "is-not-empty": "is-not-empty";
          "is-on-or-after": "is-on-or-after";
          "is-on-or-before": "is-on-or-before";
          lt: "lt";
          lte: "lte";
        }>;
        value: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString>]>>;
      }, z.core.$strip>>;
    }, z.core.$strict>>>;
  }, z.core.$strict>>;
  sorts: z.ZodOptional<z.ZodArray<z.ZodObject<{
    attributeId: z.ZodString;
    direction: z.ZodEnum<{
      asc: "asc";
      desc: "desc";
    }>;
  }, z.core.$strip>>>;
}, z.core.$strict>;
declare const boardViewCreateSchema: z.ZodObject<{
  settings: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
    viewMode: z.ZodOptional<z.ZodEnum<{
      board: "board";
      list: "list";
    }>>;
    columnGrouping: z.ZodOptional<z.ZodString>;
    rowGrouping: z.ZodOptional<z.ZodString>;
    displayProperties: z.ZodOptional<z.ZodArray<z.ZodString>>;
  }, z.core.$strict>, z.ZodObject<{
    grouping: z.ZodOptional<z.ZodString>;
    rowNumbers: z.ZodOptional<z.ZodBoolean>;
    wrapRows: z.ZodOptional<z.ZodBoolean>;
    showStats: z.ZodOptional<z.ZodBoolean>;
    hiddenColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
    columnOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
  }, z.core.$strict>]>>;
  filter: z.ZodOptional<z.ZodObject<{
    conjunction: z.ZodEnum<{
      and: "and";
      or: "or";
    }>;
    rules: z.ZodArray<z.ZodObject<{
      attributeId: z.ZodString;
      condition: z.ZodEnum<{
        contains: "contains";
        "does-not-contain": "does-not-contain";
        gt: "gt";
        gte: "gte";
        "has-all-of": "has-all-of";
        "has-any-of": "has-any-of";
        "has-none-of": "has-none-of";
        is: "is";
        "is-after": "is-after";
        "is-any-of": "is-any-of";
        "is-before": "is-before";
        "is-empty": "is-empty";
        "is-none-of": "is-none-of";
        "is-not": "is-not";
        "is-not-empty": "is-not-empty";
        "is-on-or-after": "is-on-or-after";
        "is-on-or-before": "is-on-or-before";
        lt: "lt";
        lte: "lte";
      }>;
      value: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
      conjunction: z.ZodEnum<{
        and: "and";
        or: "or";
      }>;
      rules: z.ZodArray<z.ZodObject<{
        attributeId: z.ZodString;
        condition: z.ZodEnum<{
          contains: "contains";
          "does-not-contain": "does-not-contain";
          gt: "gt";
          gte: "gte";
          "has-all-of": "has-all-of";
          "has-any-of": "has-any-of";
          "has-none-of": "has-none-of";
          is: "is";
          "is-after": "is-after";
          "is-any-of": "is-any-of";
          "is-before": "is-before";
          "is-empty": "is-empty";
          "is-none-of": "is-none-of";
          "is-not": "is-not";
          "is-not-empty": "is-not-empty";
          "is-on-or-after": "is-on-or-after";
          "is-on-or-before": "is-on-or-before";
          lt: "lt";
          lte: "lte";
        }>;
        value: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString>]>>;
      }, z.core.$strip>>;
    }, z.core.$strict>>>;
  }, z.core.$strict>>;
  sorts: z.ZodOptional<z.ZodArray<z.ZodObject<{
    attributeId: z.ZodString;
    direction: z.ZodEnum<{
      asc: "asc";
      desc: "desc";
    }>;
  }, z.core.$strip>>>;
  title: z.ZodString;
  copyFrom: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
type BoardView = z.infer<typeof boardViewSchema>;
type BoardViews = z.infer<typeof boardViewsSchema>;
type BoardViewCreate = z.infer<typeof boardViewCreateSchema>;
type BoardViewUpdate = z.infer<typeof boardViewUpdateSchema>;
interface ExtensionViewsApi {
  list(board: ViewRef): Promise<BoardViews>;
  create(board: ViewRef, input: BoardViewCreate): Promise<BoardView>;
  update(board: ViewRef, id: string, input: BoardViewUpdate): Promise<BoardView>;
  remove(board: ViewRef, id: string): Promise<{
    deleted: boolean;
  }>;
  reorder(board: ViewRef, ids: string[]): Promise<BoardViews>;
  setDefault(board: ViewRef, id: string | null): Promise<BoardViews>;
}
type Json = string | number | boolean | null | Json[] | {
  [key: string]: Json;
};
declare const syncOutcomeSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
  status: z.ZodLiteral<"saved-locally">;
  operationId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
  status: z.ZodLiteral<"pending">;
  operationId: z.ZodString;
  reason: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
  status: z.ZodLiteral<"synchronized">;
  operationId: z.ZodString;
  checkpoint: z.ZodObject<{
    epoch: z.ZodString;
    sequence: z.ZodNumber;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  status: z.ZodLiteral<"conflict">;
  operationId: z.ZodString;
  conflictId: z.ZodString;
  conflictRevision: z.ZodNumber;
}, z.core.$strict>], "status">;
type SyncOutcome = z.infer<typeof syncOutcomeSchema>;
declare const assetSchema: z.ZodObject<{
  sha256: z.ZodString;
  byteLength: z.ZodNumber;
  mediaType: z.ZodString;
}, z.core.$strict>;
type Asset = z.infer<typeof assetSchema>;
type SharedEdit = {
  kind: "text.insert";
  index: number;
  text: string;
} | {
  kind: "text.delete";
  index: number;
  count: number;
} | {
  kind: "list.insert";
  index: number;
  values: Json[];
} | {
  kind: "list.delete";
  index: number;
  count: number;
} | {
  kind: "map.set";
  key: string;
  value: Json;
} | {
  kind: "map.delete";
  key: string;
};
interface RecordEdit {
  recordId: string;
  shared?: SharedEdit[];
  replace?: Json;
  asset?: Asset | null;
  deleted?: boolean;
}
interface StorageRecord {
  recordId: string;
  exists: boolean;
  revision: string;
  value: Json;
  asset: Asset | null;
  deleted: boolean;
  shared: {
    kind: "text";
    value: string;
  } | {
    kind: "list";
    value: Json[];
  } | {
    kind: "map";
    value: Record<string, Json>;
  } | null;
}
interface StorageGroup {
  operationId: string;
  edits: (RecordEdit & {
    expectedRevision: string;
  })[];
}
interface StorageResolution {
  operationId: string;
  conflictId: string;
  expectedConflicts: {
    conflictId: string;
    revision: number;
  }[];
  capturedOperationIds: string[];
  expectedInputs: {
    recordId: string;
    revision: string;
  }[];
  choose: "local" | "remote";
  handler?: {
    publishedRevision: string;
    handlerId: string;
  };
}
interface StorageConflict {
  conflictId: string;
  revision: number;
  reason: string;
  recordIds: string[];
  alternativeOperationIds: string[];
}
interface StorageConflictInspection {
  conflictId: string;
  revision: number;
  expectedConflicts: {
    conflictId: string;
    revision: number;
  }[];
  capturedOperationIds: string[];
  expectedInputs: {
    recordId: string;
    revision: string;
  }[];
  accepted: StorageRecord[];
  alternatives: {
    operationId: string;
    parents: string[];
    records: StorageRecord[];
  }[];
}
type StorageSaveOutcome = SyncOutcome;
interface ExtensionRecordsApi {
  id(key: string): string;
  read(recordId: string, branch?: {
    operationId: string;
  }): Promise<StorageRecord>;
  list(): Promise<StorageRecord[]>;
  commit(group: StorageGroup): Promise<StorageSaveOutcome>;
  outcome(operationId: string): Promise<StorageSaveOutcome | undefined>;
  conflicts(): Promise<StorageConflict[]>;
  inspect(conflictId: string): Promise<StorageConflictInspection>;
  resolve(proposal: StorageResolution): Promise<StorageSaveOutcome>;
}
/** @deprecated */
interface ExtensionStorageCollectionApi<TItem = unknown> {
  get(id: string): Promise<TItem | undefined>;
  list(): Promise<TItem[]>;
  /** @deprecated */
  put(id: string, value: TItem): Promise<void>;
  /** @deprecated */
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
  migrate(version: number, run: (previousVersion: number) => Promise<void>): Promise<void>;
  readLegacy(source: string): Promise<{
    version: string;
    records: JsonObject[];
  } | undefined>;
  records: ExtensionRecordsApi;
  assets: ExtensionAssetsApi;
  scope(scope: StorageScope): ExtensionStorageApi;
  files: ExtensionBlobsApi;
  /** @deprecated */
  get<T = unknown>(key: string): Promise<T | undefined>;
  /** @deprecated */
  set<T = unknown>(key: string, value: T): Promise<void>;
  /** @deprecated */
  delete(key: string): Promise<void>;
  /** @deprecated */
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
interface WorkspaceProviderRef {
  version: number;
  data: JsonObject;
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
  removeAnchors(workspaceId: string, refs: ResourceRef[]): Promise<void>;
  resolve(id: string): Promise<WorkspaceProviderResult>;
  cancel(id: string): Promise<ExtensionWorkspace>;
  removeWorktree(id: string): Promise<{
    removed: boolean;
  }>;
  delete(id: string): Promise<void>;
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
  views: ExtensionViewsApi;
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
interface CommandStreamWriter<TChunk extends JsonValue = JsonValue> {
  write(chunk: TChunk): Promise<void>;
}
interface CommandContext<TSettings extends Record<string, unknown> = Record<string, unknown>, TChunk extends JsonValue = JsonValue> extends ExtensionContextBase<TSettings> {
  stream: CommandStreamWriter<TChunk>;
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
interface FileRendererSectionAnchor {
  id: string;
  heading: string;
  occurrence?: number;
}
interface FileRendererSectionTarget {
  anchors: FileRendererSectionAnchor[];
}
interface NavigationTargetPage {
  kind: "page";
  page: PageRef;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  position?: FileSourcePosition;
  open?: PageOpenIntent;
  params?: PageParams;
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
declare const automationRunStatusSchema: z.ZodEnum<{
  cancelled: "cancelled";
  failed: "failed";
  queued: "queued";
  rejected: "rejected";
  running: "running";
  succeeded: "succeeded";
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
    cancelled: "cancelled";
    failed: "failed";
    queued: "queued";
    rejected: "rejected";
    running: "running";
    succeeded: "succeeded";
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
type ContextNamespace = "project" | "storage" | "resources" | "views" | "navigation" | "artifacts" | "projectFiles" | "packageFiles" | "extensionFiles" | "files" | "skills" | "sessions" | "workspaces" | "commands" | "events" | "activity" | "notify" | "automation" | "process" | "net" | "connections" | "logger" | "settings" | "stream" | "invocation";
type CommandContextOverrides = Partial<Omit<CommandContext, ContextNamespace>> & { [K in ContextNamespace]?: Partial<CommandContext[K]>; };
interface CommandContextInput<TParams extends Record<string, unknown>> {
  storage: ExtensionStorageApi;
  params: TParams;
  projectId?: string;
  resourcePrefixes?: Record<string, string>;
  overrides?: CommandContextOverrides;
}
export declare const makeCommandContext: <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) => CommandContext<Record<string, unknown>, JsonValue>;
export declare const commandParamsFor: <TParams extends Record<string, unknown>>(context: CommandContext) => TParams;
export declare const makeCommandArgs: <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) => readonly [CommandContext<Record<string, unknown>, JsonValue>, TParams];
export declare const createMemoryRepoFiles: () => {
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, value: string): Promise<void>;
  updateText(path: string, value: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, value: Uint8Array): Promise<void>;
  list(pattern?: string): Promise<ArtifactFile[]>;
  listDirs(path?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
  files: {
    set(path: string, value: Uint8Array): /*elided*/ any;
    clear(): void;
    delete(key: string): boolean;
    forEach(callbackfn: (value: Uint8Array<ArrayBufferLike>, key: string, map: Map<string, Uint8Array<ArrayBufferLike>>) => void, thisArg?: any): void;
    get(key: string): Uint8Array<ArrayBufferLike> | undefined;
    has(key: string): boolean;
    readonly size: number;
    [Symbol.iterator](): MapIterator<[string, Uint8Array<ArrayBufferLike>]>;
    entries(): MapIterator<[string, Uint8Array<ArrayBufferLike>]>;
    keys(): MapIterator<string>;
    values(): MapIterator<Uint8Array<ArrayBufferLike>>;
    readonly [Symbol.toStringTag]: string;
  };
};
export declare const createMemoryResources: (prefixes: Record<string, string>, sequences?: Map<string, number>, links?: {
  addAnchors: (resource: ResourceRef, anchors: ResourceAnchor[]) => Promise<void>;
  removeAnchors: (resource: ResourceRef, refs: ResourceRef[]) => Promise<void>;
  listAnchors: (query: ResourceAnchorQuery) => Promise<{
    items: {
      source: ResourceRef;
      target: ResourceAnchor;
    }[];
    nextCursor?: string | undefined;
  }>;
  removed: (resource: ResourceRef) => Promise<void>;
}) => ExtensionResourcesApi;
interface MemoryStorageSeed {
  kv?: Record<string, unknown>;
  collections?: Record<string, Record<string, unknown>>;
}
interface MemoryStorageOptions extends MemoryStorageSeed {
  legacyData?: Record<string, {
    version: string;
    records: JsonObject[];
  }>;
}
export declare const createMemoryStorage: (options?: MemoryStorageOptions) => ExtensionStorageApi;
export type { CommandContextInput, CommandContextOverrides, MemoryStorageSeed };
