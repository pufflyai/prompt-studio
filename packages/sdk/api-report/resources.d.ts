import { z } from "zod";
declare const agentAvailabilityTypeSchema: z.ZodEnum<{
  INSTALLED: "INSTALLED";
  NOT_FOUND: "NOT_FOUND";
}>;
declare const agentSkillsLayoutSchema: z.ZodObject<{
  dir: z.ZodString;
  global_dir: z.ZodString;
}, z.core.$strip>;
declare const agentInfoSchema: z.ZodObject<{
  id: z.ZodString;
  name: z.ZodString;
  availability: z.ZodObject<{
    type: z.ZodEnum<{
      INSTALLED: "INSTALLED";
      NOT_FOUND: "NOT_FOUND";
    }>;
    reason: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  skills: z.ZodOptional<z.ZodObject<{
    dir: z.ZodString;
    global_dir: z.ZodString;
  }, z.core.$strip>>;
  params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
    control: z.ZodOptional<z.ZodLiteral<"command">>;
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
    control: z.ZodOptional<z.ZodLiteral<"command">>;
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
  }, z.core.$strip>]>>>;
  capabilities: z.ZodArray<z.ZodEnum<{
    Approvals: "Approvals";
    Attachments: "Attachments";
    ContextUsage: "ContextUsage";
    SessionFork: "SessionFork";
    SessionReattach: "SessionReattach";
  }>>;
  supportsModels: z.ZodBoolean;
}, z.core.$strip>;
declare const agentModelSchema: z.ZodObject<{
  id: z.ZodString;
  label: z.ZodOptional<z.ZodString>;
  description: z.ZodOptional<z.ZodString>;
  isDefault: z.ZodOptional<z.ZodBoolean>;
  paramOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodObject<{
    control: z.ZodOptional<z.ZodLiteral<"command">>;
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
    control: z.ZodOptional<z.ZodLiteral<"command">>;
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
type AgentAvailabilityType = z.infer<typeof agentAvailabilityTypeSchema>;
type AgentInfo = z.infer<typeof agentInfoSchema>;
type AgentModel = z.infer<typeof agentModelSchema>;
type AgentSkillsLayout = z.infer<typeof agentSkillsLayoutSchema>;
export declare const harnessLocalId: (id: string) => string;
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
type ContributionKind = "activity-item" | "artifact-mount" | "command" | "command-palette-resource" | "connection" | "file-icon-theme" | "harness" | "hook" | "keybinding" | "middleware" | "mode" | "navigation-item" | "navigation-tree" | "page" | "placement" | "resource-hierarchy-provider" | "resource-kind" | "schedule" | "settings-panel" | "settings-section" | "skill" | "status-bar-item" | "template" | "template-type" | "theme" | "view" | "view-menu" | "workspace-type";
interface ContributionRef<Kind extends ContributionKind> {
  readonly extensionId?: string;
  readonly kind: Kind;
  readonly id: string;
}
type PageRef = ContributionRef<"page">;
type PlacementRef = ContributionRef<"placement">;
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
type JsonObject = {
  [key: string]: JsonValue;
};
type Struct = object;
declare const sessionStatusSchema: z.ZodEnum<{
  awaiting_input: "awaiting_input";
  cancelled: "cancelled";
  completed: "completed";
  disconnected: "disconnected";
  failed: "failed";
  in_progress: "in_progress";
  queued: "queued";
}>;
declare const sessionSchema: z.ZodObject<{
  id: z.ZodString;
  project_id: z.ZodNullable<z.ZodString>;
  title: z.ZodString;
  status: z.ZodEnum<{
    awaiting_input: "awaiting_input";
    cancelled: "cancelled";
    completed: "completed";
    disconnected: "disconnected";
    failed: "failed";
    in_progress: "in_progress";
    queued: "queued";
  }>;
  archived: z.ZodBoolean;
  last_request_started: z.ZodNullable<z.ZodString>;
  last_request_ended: z.ZodNullable<z.ZodString>;
  agent: z.ZodNullable<z.ZodString>;
  last_selected_model: z.ZodNullable<z.ZodString>;
  agent_session_id: z.ZodNullable<z.ZodString>;
  session_file_id: z.ZodNullable<z.ZodString>;
  original_session_id: z.ZodNullable<z.ZodString>;
  cwd: z.ZodNullable<z.ZodString>;
  params_json: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>>;
  usage_json: z.ZodOptional<z.ZodNullable<z.ZodObject<{
    input_tokens: z.ZodNumber;
    output_tokens: z.ZodNumber;
    cache_read_tokens: z.ZodNumber;
    cache_write_tokens: z.ZodNumber;
  }, z.core.$strip>>>;
  workspace_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  anchors_json: z.ZodArray<z.ZodObject<{
    shorthand: z.ZodOptional<z.ZodString>;
    type: z.ZodString;
    id: z.ZodString;
    projectId: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    extensionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
  }, z.core.$strip>>;
  created_at: z.ZodString;
  updated_at: z.ZodString;
}, z.core.$strip>;
type SessionStatus = z.infer<typeof sessionStatusSchema>;
type Session = z.infer<typeof sessionSchema>;
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
declare const skillFileSchema: z.ZodObject<{
  path: z.ZodString;
  content: z.ZodString;
  encoding: z.ZodLiteral<"utf8">;
}, z.core.$strip>;
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
declare const skillWithContentSchema: z.ZodObject<{
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
  installed_agents: z.ZodArray<z.ZodString>;
  agent_installations: z.ZodArray<z.ZodObject<{
    agent_id: z.ZodString;
    agent_name: z.ZodString;
    installed_version: z.ZodNullable<z.ZodString>;
  }, z.core.$strip>>;
}, z.core.$strip>;
type Skill = z.infer<typeof skillSchema>;
type SkillWithContent = z.infer<typeof skillWithContentSchema>;
type SkillFile = z.infer<typeof skillFileSchema>;
type WorkspaceProviderState = "provisioning" | "ready" | "failed" | "cancelled" | "archiving" | "archived" | "deleting" | "provider_missing";
interface WorkspaceCapabilities {
  files: "none" | "read" | "write";
  diff: boolean;
  merge: boolean;
  rebase: boolean;
  delete: boolean;
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
declare const fileRecordSchema: z.ZodObject<{
  id: z.ZodString;
  project_id: z.ZodString;
  file_name: z.ZodString;
  file_kind: z.ZodString;
  storage_path: z.ZodString;
  mime_type: z.ZodNullable<z.ZodString>;
  size_bytes: z.ZodNumber;
  hash: z.ZodNullable<z.ZodString>;
  created_at: z.ZodString;
  updated_at: z.ZodString;
}, z.core.$strip>;
type FileRecord = z.infer<typeof fileRecordSchema>;
declare const projectSchema: z.ZodObject<{
  id: z.ZodString;
  name: z.ZodString;
  shorthand: z.ZodString;
  default_agent_id: z.ZodNullable<z.ZodString>;
  default_agent_model: z.ZodNullable<z.ZodString>;
  startup_script: z.ZodNullable<z.ZodString>;
  created_at: z.ZodString;
  updated_at: z.ZodString;
  deleted_at: z.ZodNullable<z.ZodString>;
  extension_warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
    code: z.ZodLiteral<"extension_setup_failed">;
    extension: z.ZodString;
    message: z.ZodString;
  }, z.core.$strip>>>;
}, z.core.$strip>;
type Project = z.infer<typeof projectSchema>;
declare const settingsSchema: z.ZodObject<{
  notifications_enabled: z.ZodBoolean;
  machine_tokens_enabled: z.ZodBoolean;
  max_concurrent_sessions: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
type Settings = z.infer<typeof settingsSchema>;
declare const workspaceSchema: z.ZodObject<{
  id: z.ZodString;
  project_id: z.ZodString;
  name: z.ZodString;
  branch: z.ZodNullable<z.ZodString>;
  root_path: z.ZodNullable<z.ZodString>;
  provider_id: z.ZodString;
  provider_params_json: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  provider_ref_json: z.ZodNullable<z.ZodObject<{
    version: z.ZodNumber;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  }, z.core.$strip>>;
  provider_state: z.ZodType<WorkspaceProviderState, unknown, z.core.$ZodTypeInternals<WorkspaceProviderState, unknown>>;
  execution_kind: z.ZodEnum<{
    local: "local";
    remote: "remote";
  }>;
  provider_operation_id: z.ZodNullable<z.ZodString>;
  provider_operation_kind: z.ZodNullable<z.ZodEnum<{
    archive: "archive";
    cancel: "cancel";
    create: "create";
    delete: "delete";
  }>>;
  provider_error_json: z.ZodNullable<z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    retryable: z.ZodBoolean;
    occurred_at: z.ZodString;
  }, z.core.$strip>>;
  provider_capabilities_json: z.ZodType<WorkspaceCapabilities, unknown, z.core.$ZodTypeInternals<WorkspaceCapabilities, unknown>>;
  display_path: z.ZodNullable<z.ZodString>;
  is_default: z.ZodBoolean;
  archived: z.ZodBoolean;
  initializing: z.ZodBoolean;
  setup_error: z.ZodNullable<z.ZodString>;
  workspace_shorthand: z.ZodString;
  startup_log_file_id: z.ZodNullable<z.ZodString>;
  anchors_json: z.ZodArray<z.ZodObject<{
    shorthand: z.ZodOptional<z.ZodString>;
    type: z.ZodString;
    id: z.ZodString;
    projectId: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    extensionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
    role: z.ZodOptional<z.ZodEnum<{
      context: "context";
      primary: "primary";
      result: "result";
      source: "source";
    }>>;
  }, z.core.$strip>>;
  created_at: z.ZodString;
  updated_at: z.ZodString;
  deleted_at: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
declare const workspaceListItemSchema: z.ZodObject<{
  id: z.ZodString;
  project_id: z.ZodString;
  name: z.ZodString;
  branch: z.ZodNullable<z.ZodString>;
  root_path: z.ZodNullable<z.ZodString>;
  provider_id: z.ZodString;
  provider_params_json: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  provider_ref_json: z.ZodNullable<z.ZodObject<{
    version: z.ZodNumber;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  }, z.core.$strip>>;
  provider_state: z.ZodType<WorkspaceProviderState, unknown, z.core.$ZodTypeInternals<WorkspaceProviderState, unknown>>;
  execution_kind: z.ZodEnum<{
    local: "local";
    remote: "remote";
  }>;
  provider_operation_id: z.ZodNullable<z.ZodString>;
  provider_operation_kind: z.ZodNullable<z.ZodEnum<{
    archive: "archive";
    cancel: "cancel";
    create: "create";
    delete: "delete";
  }>>;
  provider_error_json: z.ZodNullable<z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    retryable: z.ZodBoolean;
    occurred_at: z.ZodString;
  }, z.core.$strip>>;
  provider_capabilities_json: z.ZodType<WorkspaceCapabilities, unknown, z.core.$ZodTypeInternals<WorkspaceCapabilities, unknown>>;
  display_path: z.ZodNullable<z.ZodString>;
  is_default: z.ZodBoolean;
  archived: z.ZodBoolean;
  initializing: z.ZodBoolean;
  setup_error: z.ZodNullable<z.ZodString>;
  workspace_shorthand: z.ZodString;
  startup_log_file_id: z.ZodNullable<z.ZodString>;
  anchors_json: z.ZodArray<z.ZodObject<{
    shorthand: z.ZodOptional<z.ZodString>;
    type: z.ZodString;
    id: z.ZodString;
    projectId: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    extensionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
    role: z.ZodOptional<z.ZodEnum<{
      context: "context";
      primary: "primary";
      result: "result";
      source: "source";
    }>>;
  }, z.core.$strip>>;
  created_at: z.ZodString;
  updated_at: z.ZodString;
  deleted_at: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
type Workspace$1 = z.infer<typeof workspaceSchema>;
type WorkspaceListItem$1 = z.infer<typeof workspaceListItemSchema>;
type Workspace = Workspace$1;
type WorkspaceListItem = WorkspaceListItem$1;
export type { AgentAvailabilityType, AgentInfo, AgentModel, AgentSkillsLayout, AssetReference, AssetTransfer, CreateNotificationInput, FileRecord, ListNotificationsQuery, ListNotificationsResponse, Notification, NotificationAction, NotificationActorType, NotificationKind, NotificationOrigin, NotificationPriority, NotificationStatus, Project, Session, SessionStatus, Settings, Skill, SkillFile, SkillWithContent, UpdateNotificationInput, Workspace, WorkspaceListItem };
