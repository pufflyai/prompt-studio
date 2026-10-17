import { z } from "zod";
declare const harnessParamsSchema: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
}, z.core.$strip>]>>;
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
type AgentInfo = z.infer<typeof agentInfoSchema>;
type AgentModel = z.infer<typeof agentModelSchema>;
type HarnessParamsInfo = z.infer<typeof harnessParamsSchema>;
declare const assetReferenceSchema: z.ZodObject<{
  sha256: z.ZodString;
  byteLength: z.ZodNumber;
  mediaType: z.ZodString;
}, z.core.$strict>;
type AssetReference$1 = z.infer<typeof assetReferenceSchema>;
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
type AssetTransfer$1 = z.infer<typeof assetTransferSchema>;
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
interface WebviewArtifactFile {
  path: string;
  size: number;
  mediaType: string;
}
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
declare const queuedFollowUpUpdateResponseSchema: z.ZodObject<{
  ok: z.ZodLiteral<true>;
  request: z.ZodObject<{
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
type UpdateQueuedFollowUpInput = z.infer<typeof updateQueuedFollowUpInputSchema>;
type CombineQueuedFollowUpsInput = z.infer<typeof combineQueuedFollowUpsInputSchema>;
type QueuedFollowUpUpdateResponse = z.infer<typeof queuedFollowUpUpdateResponseSchema>;
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
declare const createSessionResponseSchema: z.ZodObject<{
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
  operation_result: z.ZodOptional<z.ZodObject<{
    status: z.ZodEnum<{
      completed: "completed";
      started: "started";
    }>;
    message: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
}, z.core.$strip>;
type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
declare const sessionAttachmentSchema: z.ZodObject<{
  file_id: z.ZodString;
  name: z.ZodString;
  mime_type: z.ZodNullable<z.ZodString>;
  size_bytes: z.ZodNumber;
  hash: z.ZodNullable<z.ZodString>;
  url: z.ZodString;
  created_at: z.ZodString;
  updated_at: z.ZodString;
}, z.core.$strip>;
declare const createSessionInputSchema: z.ZodObject<{
  project_id: z.ZodString;
  title: z.ZodString;
  prompt: z.ZodOptional<z.ZodString>;
  operation: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"command">;
    text: z.ZodString;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"mode-action">;
    modeId: z.ZodString;
    actionId: z.ZodString;
    argument: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>], "kind">>;
  agent: z.ZodOptional<z.ZodString>;
  workspace_id: z.ZodOptional<z.ZodString>;
  anchors: z.ZodOptional<z.ZodArray<z.ZodObject<{
    shorthand: z.ZodOptional<z.ZodString>;
    type: z.ZodString;
    id: z.ZodString;
    projectId: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    extensionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
  }, z.core.$strip>>>;
  attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
    file_id: z.ZodString;
  }, z.core.$strip>>>;
  model: z.ZodOptional<z.ZodString>;
  params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>>;
  original_session_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const followUpInputSchema: z.ZodObject<{
  prompt: z.ZodOptional<z.ZodString>;
  agent: z.ZodOptional<z.ZodString>;
  model: z.ZodOptional<z.ZodString>;
  question_response: z.ZodOptional<z.ZodObject<{
    answers: z.ZodArray<z.ZodArray<z.ZodString>>;
    callId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>>;
  summary_from_session_id: z.ZodOptional<z.ZodString>;
  summary_format: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
    brief: "brief";
    detailed: "detailed";
  }>>>;
  summary_role: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
    all: "all";
    assistant: "assistant";
  }>>>;
  attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
    file_id: z.ZodString;
  }, z.core.$strip>>>;
}, z.core.$strip>;
declare const approvalInputSchema: z.ZodObject<{
  id: z.ZodString;
  decision: z.ZodEnum<{
    approve: "approve";
    deny: "deny";
  }>;
}, z.core.$strip>;
declare const followUpResponseSchema: z.ZodObject<{
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
  follow_up: z.ZodUnion<readonly [z.ZodObject<{
    status: z.ZodLiteral<"dispatched">;
  }, z.core.$strip>, z.ZodObject<{
    status: z.ZodLiteral<"queued">;
    queue_position: z.ZodNumber;
  }, z.core.$strip>]>;
}, z.core.$strip>;
declare const sessionQueuedMessagesResponseSchema: z.ZodObject<{
  messages: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<{
      assistant: "assistant";
      developer: "developer";
      system: "system";
      tool: "tool";
      user: "user";
    }>;
    parts: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
      type: z.ZodLiteral<"text">;
      text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"reasoning">;
      text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"tool">;
      tool: z.ZodString;
      callId: z.ZodOptional<z.ZodString>;
      actionType: z.ZodOptional<z.ZodEnum<{
        execute: "execute";
        network: "network";
        other: "other";
        read: "read";
        write: "write";
      }>>;
      status: z.ZodOptional<z.ZodEnum<{
        completed: "completed";
        denied: "denied";
        failed: "failed";
        pending: "pending";
        running: "running";
      }>>;
      state: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodString>;
        input: z.ZodOptional<z.ZodUnknown>;
        output: z.ZodOptional<z.ZodUnknown>;
        errorText: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodUnknown>;
      }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"step-start">;
      snapshot: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"step-finish">;
      reason: z.ZodOptional<z.ZodString>;
      snapshot: z.ZodOptional<z.ZodString>;
      cost: z.ZodOptional<z.ZodNumber>;
      tokens: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"patch">;
      hash: z.ZodOptional<z.ZodString>;
      files: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"file">;
      fileId: z.ZodOptional<z.ZodString>;
      mediaType: z.ZodOptional<z.ZodString>;
      filename: z.ZodOptional<z.ZodString>;
      size: z.ZodOptional<z.ZodNumber>;
      url: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"loading">;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"error">;
      errorType: z.ZodEnum<{
        crash: "crash";
        other: "other";
        permission: "permission";
        timeout: "timeout";
      }>;
      message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"token_usage">;
      inputTokens: z.ZodNumber;
      outputTokens: z.ZodNumber;
      cacheReadTokens: z.ZodOptional<z.ZodNumber>;
      cacheWriteTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>]>>;
    index: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    modelId: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    tokens: z.ZodOptional<z.ZodObject<{
      input: z.ZodOptional<z.ZodNumber>;
      output: z.ZodOptional<z.ZodNumber>;
      reasoning: z.ZodOptional<z.ZodNumber>;
      cache: z.ZodOptional<z.ZodObject<{
        read: z.ZodOptional<z.ZodNumber>;
        write: z.ZodOptional<z.ZodNumber>;
      }, z.core.$strip>>;
    }, z.core.$strip>>;
  }, z.core.$strip>>;
  queue: z.ZodOptional<z.ZodObject<{
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
  }, z.core.$strip>>;
}, z.core.$strip>;
type SessionQueuedMessagesResponse = z.infer<typeof sessionQueuedMessagesResponseSchema>;
declare const sessionConversationSourcesSchema: z.ZodObject<{
  checkpoint: z.ZodNullable<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<{
      assistant: "assistant";
      developer: "developer";
      system: "system";
      tool: "tool";
      user: "user";
    }>;
    parts: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
      type: z.ZodLiteral<"text">;
      text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"reasoning">;
      text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"tool">;
      tool: z.ZodString;
      callId: z.ZodOptional<z.ZodString>;
      actionType: z.ZodOptional<z.ZodEnum<{
        execute: "execute";
        network: "network";
        other: "other";
        read: "read";
        write: "write";
      }>>;
      status: z.ZodOptional<z.ZodEnum<{
        completed: "completed";
        denied: "denied";
        failed: "failed";
        pending: "pending";
        running: "running";
      }>>;
      state: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodString>;
        input: z.ZodOptional<z.ZodUnknown>;
        output: z.ZodOptional<z.ZodUnknown>;
        errorText: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodUnknown>;
      }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"step-start">;
      snapshot: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"step-finish">;
      reason: z.ZodOptional<z.ZodString>;
      snapshot: z.ZodOptional<z.ZodString>;
      cost: z.ZodOptional<z.ZodNumber>;
      tokens: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"patch">;
      hash: z.ZodOptional<z.ZodString>;
      files: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"file">;
      fileId: z.ZodOptional<z.ZodString>;
      mediaType: z.ZodOptional<z.ZodString>;
      filename: z.ZodOptional<z.ZodString>;
      size: z.ZodOptional<z.ZodNumber>;
      url: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"loading">;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"error">;
      errorType: z.ZodEnum<{
        crash: "crash";
        other: "other";
        permission: "permission";
        timeout: "timeout";
      }>;
      message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"token_usage">;
      inputTokens: z.ZodNumber;
      outputTokens: z.ZodNumber;
      cacheReadTokens: z.ZodOptional<z.ZodNumber>;
      cacheWriteTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>]>>;
    index: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    modelId: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    tokens: z.ZodOptional<z.ZodObject<{
      input: z.ZodOptional<z.ZodNumber>;
      output: z.ZodOptional<z.ZodNumber>;
      reasoning: z.ZodOptional<z.ZodNumber>;
      cache: z.ZodOptional<z.ZodObject<{
        read: z.ZodOptional<z.ZodNumber>;
        write: z.ZodOptional<z.ZodNumber>;
      }, z.core.$strip>>;
    }, z.core.$strip>>;
  }, z.core.$strip>>>;
  native: z.ZodNullable<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<{
      assistant: "assistant";
      developer: "developer";
      system: "system";
      tool: "tool";
      user: "user";
    }>;
    parts: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
      type: z.ZodLiteral<"text">;
      text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"reasoning">;
      text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"tool">;
      tool: z.ZodString;
      callId: z.ZodOptional<z.ZodString>;
      actionType: z.ZodOptional<z.ZodEnum<{
        execute: "execute";
        network: "network";
        other: "other";
        read: "read";
        write: "write";
      }>>;
      status: z.ZodOptional<z.ZodEnum<{
        completed: "completed";
        denied: "denied";
        failed: "failed";
        pending: "pending";
        running: "running";
      }>>;
      state: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodString>;
        input: z.ZodOptional<z.ZodUnknown>;
        output: z.ZodOptional<z.ZodUnknown>;
        errorText: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodUnknown>;
      }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"step-start">;
      snapshot: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"step-finish">;
      reason: z.ZodOptional<z.ZodString>;
      snapshot: z.ZodOptional<z.ZodString>;
      cost: z.ZodOptional<z.ZodNumber>;
      tokens: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"patch">;
      hash: z.ZodOptional<z.ZodString>;
      files: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"file">;
      fileId: z.ZodOptional<z.ZodString>;
      mediaType: z.ZodOptional<z.ZodString>;
      filename: z.ZodOptional<z.ZodString>;
      size: z.ZodOptional<z.ZodNumber>;
      url: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"loading">;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"error">;
      errorType: z.ZodEnum<{
        crash: "crash";
        other: "other";
        permission: "permission";
        timeout: "timeout";
      }>;
      message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"token_usage">;
      inputTokens: z.ZodNumber;
      outputTokens: z.ZodNumber;
      cacheReadTokens: z.ZodOptional<z.ZodNumber>;
      cacheWriteTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>]>>;
    index: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    modelId: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    tokens: z.ZodOptional<z.ZodObject<{
      input: z.ZodOptional<z.ZodNumber>;
      output: z.ZodOptional<z.ZodNumber>;
      reasoning: z.ZodOptional<z.ZodNumber>;
      cache: z.ZodOptional<z.ZodObject<{
        read: z.ZodOptional<z.ZodNumber>;
        write: z.ZodOptional<z.ZodNumber>;
      }, z.core.$strip>>;
    }, z.core.$strip>>;
  }, z.core.$strip>>>;
  checkpointError: z.ZodNullable<z.ZodString>;
  nativeError: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
type SessionConversationSources = z.infer<typeof sessionConversationSourcesSchema>;
declare const sessionConversationResponseSchema: z.ZodObject<{
  session: z.ZodObject<{
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
  messages: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<{
      assistant: "assistant";
      developer: "developer";
      system: "system";
      tool: "tool";
      user: "user";
    }>;
    parts: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
      type: z.ZodLiteral<"text">;
      text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"reasoning">;
      text: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"tool">;
      tool: z.ZodString;
      callId: z.ZodOptional<z.ZodString>;
      actionType: z.ZodOptional<z.ZodEnum<{
        execute: "execute";
        network: "network";
        other: "other";
        read: "read";
        write: "write";
      }>>;
      status: z.ZodOptional<z.ZodEnum<{
        completed: "completed";
        denied: "denied";
        failed: "failed";
        pending: "pending";
        running: "running";
      }>>;
      state: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodString>;
        input: z.ZodOptional<z.ZodUnknown>;
        output: z.ZodOptional<z.ZodUnknown>;
        errorText: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodUnknown>;
      }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"step-start">;
      snapshot: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"step-finish">;
      reason: z.ZodOptional<z.ZodString>;
      snapshot: z.ZodOptional<z.ZodString>;
      cost: z.ZodOptional<z.ZodNumber>;
      tokens: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"patch">;
      hash: z.ZodOptional<z.ZodString>;
      files: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"file">;
      fileId: z.ZodOptional<z.ZodString>;
      mediaType: z.ZodOptional<z.ZodString>;
      filename: z.ZodOptional<z.ZodString>;
      size: z.ZodOptional<z.ZodNumber>;
      url: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"loading">;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"error">;
      errorType: z.ZodEnum<{
        crash: "crash";
        other: "other";
        permission: "permission";
        timeout: "timeout";
      }>;
      message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      type: z.ZodLiteral<"token_usage">;
      inputTokens: z.ZodNumber;
      outputTokens: z.ZodNumber;
      cacheReadTokens: z.ZodOptional<z.ZodNumber>;
      cacheWriteTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>]>>;
    index: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodNumber>;
    modelId: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    tokens: z.ZodOptional<z.ZodObject<{
      input: z.ZodOptional<z.ZodNumber>;
      output: z.ZodOptional<z.ZodNumber>;
      reasoning: z.ZodOptional<z.ZodNumber>;
      cache: z.ZodOptional<z.ZodObject<{
        read: z.ZodOptional<z.ZodNumber>;
        write: z.ZodOptional<z.ZodNumber>;
      }, z.core.$strip>>;
    }, z.core.$strip>>;
  }, z.core.$strip>>;
}, z.core.$strip>;
declare const resolveSessionIdInputSchema: z.ZodObject<{
  agent: z.ZodString;
  agent_session_id: z.ZodString;
  cwd: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const resolveSessionIdResponseSchema: z.ZodObject<{
  session_id: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
declare const listSessionActivityInputSchema: z.ZodObject<{
  event_type: z.ZodOptional<z.ZodString>;
  from: z.ZodOptional<z.ZodString>;
  to: z.ZodOptional<z.ZodString>;
  cursor: z.ZodOptional<z.ZodString>;
  limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
declare const listSessionActivityResponseSchema: z.ZodObject<{
  events: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    project_id: z.ZodString;
    resource_type: z.ZodString;
    resource_id: z.ZodString;
    source_extension_id: z.ZodNullable<z.ZodString>;
    event_type: z.ZodString;
    actor_type: z.ZodEnum<{
      agent: "agent";
      system: "system";
      user: "user";
    }>;
    actor_id: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<{
      agent: "agent";
      api: "api";
      hook: "hook";
      system: "system";
      ui: "ui";
    }>;
    summary: z.ZodString;
    payload_json: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    created_at: z.ZodString;
  }, z.core.$strip>>;
  next_cursor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
type Session = z.infer<typeof sessionSchema>;
type ResolveSessionIdInput = z.infer<typeof resolveSessionIdInputSchema>;
type ResolveSessionIdResponse = z.infer<typeof resolveSessionIdResponseSchema>;
type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
type FollowUpInput = z.infer<typeof followUpInputSchema>;
type SessionAttachment = z.infer<typeof sessionAttachmentSchema>;
type ApprovalInput = z.infer<typeof approvalInputSchema>;
type SessionConversationResponse = z.infer<typeof sessionConversationResponseSchema>;
type ListSessionActivityInput = z.infer<typeof listSessionActivityInputSchema>;
type ListSessionActivityResponse = z.infer<typeof listSessionActivityResponseSchema>;
type FollowUpResponse = z.infer<typeof followUpResponseSchema>;
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
declare const updateSkillInputSchema: z.ZodObject<{
  enabled: z.ZodOptional<z.ZodBoolean>;
  title: z.ZodOptional<z.ZodString>;
  description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type Skill = z.infer<typeof skillSchema>;
type SkillWithContent = z.infer<typeof skillWithContentSchema>;
type UpdateSkillInput = z.infer<typeof updateSkillInputSchema>;
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
type BoardViewCreate = z.infer<typeof boardViewCreateSchema>;
type BoardViewUpdate = z.infer<typeof boardViewUpdateSchema>;
declare const environmentIdentitySchema: z.ZodObject<{
  environmentId: z.ZodString;
}, z.core.$strict>;
declare const environmentTargetSchema: z.ZodObject<{
  environmentId: z.ZodString;
  workbenchId: z.ZodString;
  workspaceId: z.ZodString;
}, z.core.$strict>;
type EnvironmentIdentity = z.infer<typeof environmentIdentitySchema>;
type EnvironmentTarget = z.infer<typeof environmentTargetSchema>;
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
type HarnessParamValue = string | boolean;
type HarnessParams = Record<string, HarnessParamValue>;
declare const harnessCommandStateSchema: z.ZodObject<{
  commands: z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    argumentHelp: z.ZodOptional<z.ZodString>;
    composer: z.ZodOptional<z.ZodObject<{
      label: z.ZodString;
      modeId: z.ZodOptional<z.ZodString>;
      reservedArguments: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    disabledReason: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  modes: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    description: z.ZodString;
    state: z.ZodString;
    indicator: z.ZodOptional<z.ZodObject<{
      label: z.ZodString;
      tone: z.ZodEnum<{
        error: "error";
        info: "info";
        neutral: "neutral";
        success: "success";
        warning: "warning";
      }>;
    }, z.core.$strip>>;
    tagText: z.ZodOptional<z.ZodString>;
    closeActionId: z.ZodOptional<z.ZodString>;
    confirmation: z.ZodOptional<z.ZodObject<{
      id: z.ZodString;
      title: z.ZodString;
      actionId: z.ZodString;
      cancelLabel: z.ZodOptional<z.ZodString>;
      model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    actions: z.ZodArray<z.ZodObject<{
      id: z.ZodString;
      label: z.ZodString;
      icon: z.ZodOptional<z.ZodString>;
      argument: z.ZodOptional<z.ZodObject<{
        label: z.ZodString;
        value: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>>;
    }, z.core.$strip>>;
  }, z.core.$strip>>;
  slashCommands: z.ZodBoolean;
}, z.core.$strip>;
declare const harnessOperationSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
  kind: z.ZodLiteral<"command">;
  text: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"mode-action">;
  modeId: z.ZodString;
  actionId: z.ZodString;
  argument: z.ZodOptional<z.ZodString>;
}, z.core.$strict>], "kind">;
type HarnessCommandState = z.infer<typeof harnessCommandStateSchema>;
type HarnessOperation = z.infer<typeof harnessOperationSchema>;
declare const draftHarnessCommandInputSchema: z.ZodObject<{
  project_id: z.ZodString;
  agent: z.ZodString;
  workspace_id: z.ZodOptional<z.ZodString>;
  model: z.ZodOptional<z.ZodString>;
  params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>>;
}, z.core.$strict>;
type DraftHarnessCommandInput = z.infer<typeof draftHarnessCommandInputSchema>;
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
type Workspace$1 = Workspace;
type WorkspaceListItem$1 = WorkspaceListItem;
declare const issueAutomationTokenInputSchema: z.ZodObject<{
  name: z.ZodString;
  projectId: z.ZodString;
  principalId: z.ZodOptional<z.ZodString>;
  commandScopes: z.ZodArray<z.ZodString>;
  expiresInSeconds: z.ZodNumber;
}, z.core.$strict>;
declare const issueAutomationTokenResponseSchema: z.ZodObject<{
  id: z.ZodString;
  principalId: z.ZodString;
  name: z.ZodString;
  tokenPrefix: z.ZodString;
  projectId: z.ZodString;
  commandScopes: z.ZodArray<z.ZodString>;
  expiresAt: z.ZodString;
  lastUsedAt: z.ZodNullable<z.ZodString>;
  revokedAt: z.ZodNullable<z.ZodString>;
  createdAt: z.ZodString;
  token: z.ZodString;
}, z.core.$strip>;
declare const listAutomationTokensResponseSchema: z.ZodObject<{
  tokens: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    principalId: z.ZodString;
    name: z.ZodString;
    tokenPrefix: z.ZodString;
    projectId: z.ZodString;
    commandScopes: z.ZodArray<z.ZodString>;
    expiresAt: z.ZodString;
    lastUsedAt: z.ZodNullable<z.ZodString>;
    revokedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
  }, z.core.$strip>>;
}, z.core.$strip>;
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
declare const listAutomationRunEventsResponseSchema: z.ZodObject<{
  events: z.ZodArray<z.ZodObject<{
    cursor: z.ZodNumber;
    runId: z.ZodString;
    type: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    createdAt: z.ZodString;
  }, z.core.$strip>>;
}, z.core.$strip>;
type IssueAutomationTokenInput = z.infer<typeof issueAutomationTokenInputSchema>;
type IssueAutomationTokenResponse = z.infer<typeof issueAutomationTokenResponseSchema>;
type ListAutomationTokensResponse = z.infer<typeof listAutomationTokensResponseSchema>;
type CreateAutomationRunInput = z.infer<typeof createAutomationRunInputSchema>;
type AutomationRun = z.infer<typeof automationRunSchema>;
type ListAutomationRunEventsResponse = z.infer<typeof listAutomationRunEventsResponseSchema>;
declare const bindEnvironmentInputSchema: z.ZodObject<{
  environmentId: z.ZodString;
  name: z.ZodString;
  initial_workspace: z.ZodObject<{
    provider_id: z.ZodString;
    params: z.ZodDefault<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
  }, z.core.$strip>;
}, z.core.$strict>;
declare const environmentBindingSchema: z.ZodObject<{
  environmentId: z.ZodString;
  workbenchId: z.ZodString;
  workspace: z.ZodObject<{
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
}, z.core.$strict>;
type BindEnvironmentInput = z.infer<typeof bindEnvironmentInputSchema>;
type EnvironmentBinding = z.infer<typeof environmentBindingSchema>;
declare const extensionResourceRefSchema: z.ZodObject<{
  shorthand: z.ZodOptional<z.ZodString>;
  type: z.ZodString;
  id: z.ZodString;
  projectId: z.ZodOptional<z.ZodString>;
  label: z.ZodOptional<z.ZodString>;
  icon: z.ZodOptional<z.ZodString>;
  extensionId: z.ZodOptional<z.ZodString>;
  metadata: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
}, z.core.$strip>;
declare const pageRefSchema: z.ZodObject<{
  extensionId: z.ZodString;
  kind: z.ZodLiteral<"page">;
  id: z.ZodString;
}, z.core.$strip>;
declare const sectionSchema: z.ZodObject<{
  anchors: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    heading: z.ZodString;
    occurrence: z.ZodOptional<z.ZodNumber>;
  }, z.core.$strip>>;
}, z.core.$strip>;
interface MetadataPageTarget {
  kind: "page";
  page: z.infer<typeof pageRefSchema>;
  resource?: z.infer<typeof extensionResourceRefSchema>;
  open?: "preview" | "pin";
  section?: z.infer<typeof sectionSchema>;
  position?: FileSourcePosition;
  params?: PageParams;
  parent?: MetadataPageTarget;
}
declare const listExtensionCommandsResponseSchema: z.ZodObject<{
  commands: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    extensionId: z.ZodString;
    title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
    cliPath: z.ZodOptional<z.ZodString>;
    cliAliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
    examples: z.ZodOptional<z.ZodArray<z.ZodString>>;
    automation: z.ZodOptional<z.ZodBoolean>;
    mutating: z.ZodOptional<z.ZodBoolean>;
    resourceMutation: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"rename">;
      resourceType: z.ZodString;
      idParam: z.ZodString;
      labelParam: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
      kind: z.ZodLiteral<"remove">;
      resourceType: z.ZodString;
      idParam: z.ZodString;
    }, z.core.$strip>], "kind">>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
      type: z.ZodString;
    }, z.core.$catchall<z.ZodUnknown>>>>;
  }, z.core.$strip>>;
  translations: z.ZodOptional<z.ZodArray<z.ZodObject<{
    extensionId: z.ZodString;
    defaultLocale: z.ZodString;
    bundles: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>>;
  }, z.core.$strip>>>;
  diagnostics: z.ZodArray<z.ZodObject<{
    code: z.ZodString;
    severity: z.ZodEnum<{
      error: "error";
      info: "info";
      warning: "warning";
    }>;
    message: z.ZodString;
    extensionId: z.ZodOptional<z.ZodString>;
    commandId: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  }, z.core.$strip>>;
}, z.core.$strip>;
declare const listExtensionAppearanceResponseSchema: z.ZodObject<{
  themes: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    extensionId: z.ZodString;
    title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
    format: z.ZodLiteral<"vscode-color-theme">;
    mode: z.ZodEnum<{
      dark: "dark";
      light: "light";
    }>;
    source: z.ZodObject<{
      kind: z.ZodLiteral<"package-asset">;
      path: z.ZodString;
      baseUrl: z.ZodString;
    }, z.core.$strip>;
    tokens: z.ZodRecord<z.ZodString, z.ZodString>;
    monacoTheme: z.ZodObject<{
      base: z.ZodEnum<{
        vs: "vs";
        "vs-dark": "vs-dark";
      }>;
      inherit: z.ZodLiteral<true>;
      rules: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
      colors: z.ZodRecord<z.ZodString, z.ZodString>;
    }, z.core.$strip>;
  }, z.core.$strip>>;
  fileIconThemes: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    extensionId: z.ZodString;
    title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
    format: z.ZodLiteral<"vscode-file-icon-theme">;
    source: z.ZodObject<{
      kind: z.ZodLiteral<"package-asset">;
      path: z.ZodString;
      baseUrl: z.ZodString;
    }, z.core.$strip>;
    definitions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    fileExtensions: z.ZodRecord<z.ZodString, z.ZodString>;
    fileNames: z.ZodRecord<z.ZodString, z.ZodString>;
    defaults: z.ZodDefault<z.ZodObject<{
      file: z.ZodOptional<z.ZodString>;
      folder: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    fonts: z.ZodDefault<z.ZodArray<z.ZodObject<{
      fontFamily: z.ZodString;
      src: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        format: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>>;
      weight: z.ZodOptional<z.ZodString>;
      style: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
  }, z.core.$strip>>;
  translations: z.ZodArray<z.ZodObject<{
    extensionId: z.ZodString;
    defaultLocale: z.ZodString;
    bundles: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>>;
  }, z.core.$strip>>;
  diagnostics: z.ZodArray<z.ZodObject<{
    code: z.ZodString;
    severity: z.ZodEnum<{
      error: "error";
      info: "info";
      warning: "warning";
    }>;
    message: z.ZodString;
    extensionId: z.ZodOptional<z.ZodString>;
    commandId: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  }, z.core.$strip>>;
}, z.core.$strip>;
type ListExtensionCommandsResponse = z.infer<typeof listExtensionCommandsResponseSchema>;
type ListExtensionAppearanceResponse = z.infer<typeof listExtensionAppearanceResponseSchema>;
declare const extensionConnectionRecordSchema: z.ZodObject<{
  id: z.ZodString;
  extensionId: z.ZodString;
  connectionId: z.ZodString;
  baseUrl: z.ZodString;
  authType: z.ZodEnum<{
    bearer: "bearer";
    header: "header";
  }>;
  configured: z.ZodBoolean;
  lastCheck: z.ZodNullable<z.ZodObject<{
    ok: z.ZodBoolean;
    status: z.ZodNullable<z.ZodNumber>;
    error: z.ZodNullable<z.ZodString>;
    checkedAt: z.ZodString;
  }, z.core.$strip>>;
  updatedAt: z.ZodString;
}, z.core.$strip>;
declare const configureExtensionConnectionSchema: z.ZodObject<{
  baseUrl: z.ZodURL;
  secret: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const listExtensionConnectionsResponseSchema: z.ZodObject<{
  connections: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    extensionId: z.ZodString;
    connectionId: z.ZodString;
    baseUrl: z.ZodString;
    authType: z.ZodEnum<{
      bearer: "bearer";
      header: "header";
    }>;
    configured: z.ZodBoolean;
    lastCheck: z.ZodNullable<z.ZodObject<{
      ok: z.ZodBoolean;
      status: z.ZodNullable<z.ZodNumber>;
      error: z.ZodNullable<z.ZodString>;
      checkedAt: z.ZodString;
    }, z.core.$strip>>;
    updatedAt: z.ZodString;
  }, z.core.$strip>>;
}, z.core.$strip>;
type ExtensionConnectionRecord = z.infer<typeof extensionConnectionRecordSchema>;
type ConfigureExtensionConnectionInput = z.infer<typeof configureExtensionConnectionSchema>;
type ListExtensionConnectionsResponse = z.infer<typeof listExtensionConnectionsResponseSchema>;
declare const commandExecuteRequestSchema: z.ZodObject<{
  projectId: z.ZodString;
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
  attachment: z.ZodOptional<z.ZodObject<{
    target: z.ZodUnion<readonly [z.ZodEnum<{
      "workbench.nav.actions": "workbench.nav.actions";
      "workbench.nav.overflow": "workbench.nav.overflow";
    }>, z.ZodEnum<{
      "workbench.left.tree": "workbench.left.tree";
      "workbench.main.left.tree": "workbench.main.left.tree";
      "workbench.main.right.tree": "workbench.main.right.tree";
    }>, z.ZodEnum<{
      "workbench.main": "workbench.main";
      "workbench.main.left": "workbench.main.left";
      "workbench.main.right": "workbench.main.right";
      "workbench.secondary": "workbench.secondary";
    }>, z.ZodEnum<{
      "workbench.settings": "workbench.settings";
    }>]>;
    mode: z.ZodOptional<z.ZodString>;
    projectId: z.ZodOptional<z.ZodString>;
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
  }, z.core.$strip>>;
  slot: z.ZodOptional<z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
      dataTableRenderer: "dataTableRenderer";
      kanbanRenderer: "kanbanRenderer";
      menu: "menu";
      panel: "panel";
      renderer: "renderer";
      settings: "settings";
    }>;
    context: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  }, z.core.$strip>>;
  source: z.ZodOptional<z.ZodEnum<{
    api: "api";
    automation: "automation";
    cli: "cli";
    "command-panel": "command-panel";
    dashboard: "dashboard";
    event: "event";
    schedule: "schedule";
  }>>;
  metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
declare const commandExecuteResponseSchema: z.ZodObject<{
  commandId: z.ZodString;
  extensionId: z.ZodString;
  eventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
  outcome: z.ZodObject<{
    ok: z.ZodBoolean;
    status: z.ZodEnum<{
      error: "error";
      rejected: "rejected";
      success: "success";
    }>;
    value: z.ZodOptional<z.ZodUnknown>;
    navigationRequests: z.ZodOptional<z.ZodArray<z.ZodType<NavigationTarget, unknown, z.core.$ZodTypeInternals<NavigationTarget, unknown>>>>;
    code: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    error: z.ZodOptional<z.ZodObject<{
      name: z.ZodOptional<z.ZodString>;
      message: z.ZodString;
      stack: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    notices: z.ZodOptional<z.ZodArray<z.ZodObject<{
      type: z.ZodEnum<{
        error: "error";
        info: "info";
        success: "success";
        warning: "warning";
      }>;
      title: z.ZodOptional<z.ZodString>;
      message: z.ZodString;
      metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
    diagnostics: z.ZodOptional<z.ZodArray<z.ZodObject<{
      code: z.ZodString;
      message: z.ZodString;
      severity: z.ZodEnum<{
        error: "error";
        info: "info";
        warning: "warning";
      }>;
      extensionId: z.ZodOptional<z.ZodString>;
      commandId: z.ZodOptional<z.ZodString>;
      metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
  }, z.core.$strip>;
}, z.core.$strip>;
type CommandExecuteRequest = z.infer<typeof commandExecuteRequestSchema>;
type CommandExecuteResponse = z.infer<typeof commandExecuteResponseSchema>;
type DispatchExtensionEventInput = {
  eventId: string;
  payload: Struct;
};
declare const enableInstalledExtensionRequestSchema: z.ZodObject<{
  displayName: z.ZodString;
  extensionId: z.ZodString;
  manifest: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  name: z.ZodString;
  sourceHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  sourceKind: z.ZodEnum<{
    git: "git";
    local_path: "local_path";
    registry: "registry";
  }>;
  sourcePath: z.ZodString;
  sourceRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
declare const enableInstalledExtensionResponseSchema: z.ZodObject<{
  enabled: z.ZodLiteral<true>;
  installName: z.ZodString;
  installedExtensionId: z.ZodString;
  instanceId: z.ZodString;
  name: z.ZodString;
  projectId: z.ZodString;
}, z.core.$strip>;
declare const listProjectExtensionsResponseSchema: z.ZodObject<{
  extensions: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    extensionId: z.ZodString;
    installedExtensionId: z.ZodString;
    installName: z.ZodString;
    name: z.ZodString;
    displayName: z.ZodString;
    version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodString;
    scope: z.ZodEnum<{
      global: "global";
      repo: "repo";
    }>;
    status: z.ZodEnum<{
      disabled: "disabled";
      error: "error";
      loaded: "loaded";
      missing: "missing";
      pending: "pending";
    }>;
    lastLoadedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastError: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    enabled: z.ZodBoolean;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    canUpgrade: z.ZodBoolean;
    updateAvailable: z.ZodBoolean;
  }, z.core.$strip>>;
  marketplace: z.ZodArray<z.ZodObject<{
    installName: z.ZodString;
    displayName: z.ZodString;
    description: z.ZodString;
    installed: z.ZodBoolean;
    origin: z.ZodObject<{
      kind: z.ZodLiteral<"git">;
      url: z.ZodString;
      path: z.ZodString;
      ref: z.ZodString;
    }, z.core.$strip>;
    publisher: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
}, z.core.$strip>;
declare const upgradeProjectExtensionResponseSchema: z.ZodObject<{
  changed: z.ZodBoolean;
  extension: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    extensionId: z.ZodString;
    installedExtensionId: z.ZodString;
    installName: z.ZodString;
    name: z.ZodString;
    displayName: z.ZodString;
    version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodString;
    scope: z.ZodEnum<{
      global: "global";
      repo: "repo";
    }>;
    status: z.ZodEnum<{
      disabled: "disabled";
      error: "error";
      loaded: "loaded";
      missing: "missing";
      pending: "pending";
    }>;
    lastLoadedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastError: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    enabled: z.ZodBoolean;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    canUpgrade: z.ZodBoolean;
    updateAvailable: z.ZodBoolean;
  }, z.core.$strip>;
}, z.core.$strip>;
type EnableInstalledExtensionRequest = z.infer<typeof enableInstalledExtensionRequestSchema>;
type EnableInstalledExtensionResponse = z.infer<typeof enableInstalledExtensionResponseSchema>;
type ListProjectExtensionsResponse = z.infer<typeof listProjectExtensionsResponseSchema>;
type UpgradeProjectExtensionResponse = z.infer<typeof upgradeProjectExtensionResponseSchema>;
declare const installExtensionRequestSchema: z.ZodObject<{
  source: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"catalog">;
    name: z.ZodString;
    ref: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"project-folder">;
    path: z.ZodString;
    development: z.ZodOptional<z.ZodBoolean>;
  }, z.core.$strict>], "kind">;
  installName: z.ZodOptional<z.ZodString>;
  force: z.ZodOptional<z.ZodBoolean>;
  skipInstall: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
declare const installExtensionResponseSchema: z.ZodObject<{
  source: z.ZodObject<{
    check: z.ZodObject<{
      extensions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        displayName: z.ZodString;
        extensionInstanceId: z.ZodOptional<z.ZodString>;
        installedExtensionId: z.ZodOptional<z.ZodString>;
        installName: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodString;
      }, z.core.$strip>>;
      commands: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        cliPath: z.ZodOptional<z.ZodString>;
        cliAliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
        examples: z.ZodOptional<z.ZodArray<z.ZodString>>;
        automation: z.ZodOptional<z.ZodBoolean>;
        mutating: z.ZodOptional<z.ZodBoolean>;
        resourceMutation: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
          kind: z.ZodLiteral<"rename">;
          resourceType: z.ZodString;
          idParam: z.ZodString;
          labelParam: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"remove">;
          resourceType: z.ZodString;
          idParam: z.ZodString;
        }, z.core.$strip>], "kind">>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
          type: z.ZodString;
        }, z.core.$catchall<z.ZodUnknown>>>>;
      }, z.core.$strip>>;
      menuContributions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        commandId: z.ZodString;
        slotId: z.ZodString;
        target: z.ZodOptional<z.ZodEnum<{
          "workbench.nav.actions": "workbench.nav.actions";
          "workbench.nav.overflow": "workbench.nav.overflow";
        }>>;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        group: z.ZodOptional<z.ZodString>;
        placement: z.ZodOptional<z.ZodEnum<{
          default: "default";
          first: "first";
          last: "last";
        }>>;
        icon: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodEnum<{
          button: "button";
          "icon-button": "icon-button";
          "menu-item": "menu-item";
        }>>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          viewId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodString>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        disabledWhen: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          viewId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodString>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        disabledReason: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
      }, z.core.$strip>>;
      commandPaletteContributions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        commandId: z.ZodString;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        group: z.ZodOptional<z.ZodString>;
        placement: z.ZodOptional<z.ZodEnum<{
          default: "default";
          first: "first";
          last: "last";
        }>>;
        icon: z.ZodOptional<z.ZodString>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          viewId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodString>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
      }, z.core.$strip>>>;
      modes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodOptional<z.ZodString>;
        regions: z.ZodArray<z.ZodEnum<{
          main: "main";
          secondary: "secondary";
          side: "side";
        }>>;
        floatingPanels: z.ZodOptional<z.ZodEnum<{
          hidden: "hidden";
          visible: "visible";
        }>>;
        regionSettings: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
          main: "main";
          secondary: "secondary";
          side: "side";
          sidenav: "sidenav";
        }> & z.core.$partial, z.ZodObject<{
          showHeader: z.ZodOptional<z.ZodBoolean>;
          size: z.ZodOptional<z.ZodObject<{
            defaultPx: z.ZodOptional<z.ZodNumber>;
            minPx: z.ZodOptional<z.ZodNumber>;
            maxPx: z.ZodOptional<z.ZodNumber>;
          }, z.core.$strip>>;
          collapsible: z.ZodOptional<z.ZodBoolean>;
          alwaysShowTabs: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        defaultTheme: z.ZodOptional<z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"theme">;
          id: z.ZodString;
        }, z.core.$strip>>;
        chrome: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
          activity: "activity";
          nav: "nav";
          sidenav: "sidenav";
          status: "status";
        }> & z.core.$partial, z.ZodUnion<readonly [z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>, z.ZodLiteral<false>]>>>;
      }, z.core.$strip>>;
      pages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
          type: z.ZodLiteral<"string">;
          default: z.ZodOptional<z.ZodString>;
          values: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        }, z.core.$strict>, z.ZodObject<{
          type: z.ZodLiteral<"number">;
          default: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
          type: z.ZodLiteral<"boolean">;
          default: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
          type: z.ZodLiteral<"string[]">;
          default: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        }, z.core.$strict>], "type">>>;
        document: z.ZodOptional<z.ZodObject<{
          metadataKey: z.ZodString;
        }, z.core.$strip>>;
        mode: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>;
        parent: z.ZodOptional<z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"page">;
          id: z.ZodString;
        }, z.core.$strip>>;
        resource: z.ZodOptional<z.ZodObject<{
          kinds: z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"resource-kind">;
            id: z.ZodString;
          }, z.core.$strip>>;
        }, z.core.$strict>>;
        main: z.ZodDiscriminatedUnion<[z.ZodObject<{
          mountStrategy: z.ZodOptional<z.ZodEnum<{
            active: "active";
            "keep-mounted": "keep-mounted";
          }>>;
          hiddenByDefault: z.ZodOptional<z.ZodBoolean>;
          headerBorderBottom: z.ZodOptional<z.ZodBoolean>;
          tab: z.ZodOptional<z.ZodObject<{
            queryHandlerId: z.ZodString;
            refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>>;
          kind: z.ZodLiteral<"view">;
          view: z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>;
          cardinality: z.ZodEnum<{
            many: "many";
            one: "one";
          }>;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"panels">;
          empty: z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>;
        }, z.core.$strict>], "kind">;
        slots: z.ZodArray<z.ZodObject<{
          mountStrategy: z.ZodOptional<z.ZodEnum<{
            active: "active";
            "keep-mounted": "keep-mounted";
          }>>;
          hiddenByDefault: z.ZodOptional<z.ZodBoolean>;
          headerBorderBottom: z.ZodOptional<z.ZodBoolean>;
          tab: z.ZodOptional<z.ZodObject<{
            queryHandlerId: z.ZodString;
            refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>>;
          id: z.ZodString;
          region: z.ZodEnum<{
            main: "main";
            secondary: "secondary";
            side: "side";
          }>;
          order: z.ZodOptional<z.ZodNumber>;
          item: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"view">;
            view: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"view">;
              id: z.ZodString;
            }, z.core.$strip>;
            presence: z.ZodEnum<{
              closed: "closed";
              fixed: "fixed";
              open: "open";
            }>;
          }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"binding">;
            binding: z.ZodObject<{
              kinds: z.ZodArray<z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"resource-kind">;
                id: z.ZodString;
              }, z.core.$strip>>;
              view: z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"view">;
                id: z.ZodString;
              }, z.core.$strip>;
              cardinality: z.ZodEnum<{
                many: "many";
                one: "one";
              }>;
              add: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
                kind: z.ZodLiteral<"panel">;
                panel: z.ZodUnion<readonly [z.ZodObject<{
                  extensionId: z.ZodString;
                  kind: z.ZodLiteral<"placement">;
                  id: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                  kind: z.ZodLiteral<"page-slot">;
                  page: z.ZodObject<{
                    extensionId: z.ZodString;
                    kind: z.ZodLiteral<"page">;
                    id: z.ZodString;
                  }, z.core.$strip>;
                  id: z.ZodString;
                }, z.core.$strip>]>;
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
                open: z.ZodOptional<z.ZodEnum<{
                  pin: "pin";
                  preview: "preview";
                }>>;
              }, z.core.$strip>]>, z.ZodObject<{
                kind: z.ZodLiteral<"command">;
                target: z.ZodObject<{
                  command: z.ZodObject<{
                    extensionId: z.ZodString;
                    kind: z.ZodLiteral<"command">;
                    id: z.ZodString;
                  }, z.core.$strip>;
                  params: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
                }, z.core.$strip>;
              }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"href">;
                href: z.ZodString;
              }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"compound">;
                targets: z.ZodArray<z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
                  kind: z.ZodLiteral<"panel">;
                  panel: z.ZodUnion<readonly [z.ZodObject<{
                    extensionId: z.ZodString;
                    kind: z.ZodLiteral<"placement">;
                    id: z.ZodString;
                  }, z.core.$strip>, z.ZodObject<{
                    kind: z.ZodLiteral<"page-slot">;
                    page: z.ZodObject<{
                      extensionId: z.ZodString;
                      kind: z.ZodLiteral<"page">;
                      id: z.ZodString;
                    }, z.core.$strip>;
                    id: z.ZodString;
                  }, z.core.$strip>]>;
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
                  open: z.ZodOptional<z.ZodEnum<{
                    pin: "pin";
                    preview: "preview";
                  }>>;
                }, z.core.$strip>]>>;
              }, z.core.$strip>]>>;
            }, z.core.$strict>;
          }, z.core.$strict>], "kind">;
          openOn: z.ZodOptional<z.ZodLiteral<"page-resource">>;
        }, z.core.$strict>>;
      }, z.core.$strip>>;
      views: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodOptional<z.ZodString>;
        body: z.ZodDiscriminatedUnion<[z.ZodObject<{
          kind: z.ZodLiteral<"webview">;
          webview: z.ZodObject<{
            entry: z.ZodObject<{
              kind: z.ZodLiteral<"package-asset">;
              path: z.ZodString;
              baseUrl: z.ZodString;
            }, z.core.$strip>;
            title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            capabilities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            runtimeUrl: z.ZodString;
            moduleUrl: z.ZodString;
            styles: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          searchable: z.ZodOptional<z.ZodBoolean>;
          searchPlaceholder: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          headerHandlerId: z.ZodOptional<z.ZodString>;
          bodyHandlerId: z.ZodString;
          childrenHandlerId: z.ZodOptional<z.ZodString>;
          moveHandlerId: z.ZodOptional<z.ZodString>;
          footerHandlerId: z.ZodOptional<z.ZodString>;
          defaultExpandedSectionIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          defaultExpandedNodeIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          kind: z.ZodLiteral<"tree">;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          loadHandlerId: z.ZodString;
          saveHandlerId: z.ZodOptional<z.ZodString>;
          kind: z.ZodLiteral<"file">;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          queryHandlerId: z.ZodString;
          valueChangeHandlerId: z.ZodOptional<z.ZodString>;
          applyHandlerId: z.ZodOptional<z.ZodString>;
          resetHandlerId: z.ZodOptional<z.ZodString>;
          defaultValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>, z.ZodArray<z.ZodString>, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
          }, z.core.$strict>, z.ZodObject<{
            harnessId: z.ZodString;
            model: z.ZodOptional<z.ZodString>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>>;
          }, z.core.$strict>]>>>;
          kind: z.ZodLiteral<"controls">;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          extensionInstanceId: z.ZodOptional<z.ZodString>;
          attributes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            type: z.ZodDiscriminatedUnion<[z.ZodObject<{
              kind: z.ZodLiteral<"enum">;
              options: z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                  $l10n: z.ZodString;
                  default: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>]>;
                color: z.ZodOptional<z.ZodString>;
                icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
              }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"enum-multi">;
              options: z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                  $l10n: z.ZodString;
                  default: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>]>;
                color: z.ZodOptional<z.ZodString>;
                icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
              }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"boolean">;
              legacyValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"string">;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"date">;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"number">;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"user">;
            }, z.core.$strip>], "kind">;
            filterable: z.ZodOptional<z.ZodBoolean>;
            groupable: z.ZodOptional<z.ZodBoolean>;
            sortable: z.ZodOptional<z.ZodBoolean>;
            displayable: z.ZodOptional<z.ZodBoolean>;
            editable: z.ZodOptional<z.ZodBoolean>;
            display: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
              kind: z.ZodLiteral<"badge-list">;
              itemsAttributeId: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodString;
            }, z.core.$loose>]>>;
          }, z.core.$strip>>>;
          queryHandlerId: z.ZodString;
          attributeChangeHandlerId: z.ZodOptional<z.ZodString>;
          moveHandlerId: z.ZodOptional<z.ZodString>;
          schemaRefreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          columnActionHandlerId: z.ZodOptional<z.ZodString>;
          rowActivationHandlerId: z.ZodOptional<z.ZodString>;
          defaultSettings: z.ZodOptional<z.ZodObject<{
            viewMode: z.ZodOptional<z.ZodEnum<{
              board: "board";
              list: "list";
            }>>;
            columnGrouping: z.ZodOptional<z.ZodString>;
            rowGrouping: z.ZodOptional<z.ZodString>;
            displayProperties: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>>;
          defaultFilter: z.ZodOptional<z.ZodObject<{
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
          defaultSorts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            attributeId: z.ZodString;
            direction: z.ZodEnum<{
              asc: "asc";
              desc: "desc";
            }>;
          }, z.core.$strip>>>;
          defaultViews: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            settings: z.ZodObject<{
              viewMode: z.ZodEnum<{
                board: "board";
                list: "list";
              }>;
              columnGrouping: z.ZodString;
              rowGrouping: z.ZodString;
              displayProperties: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
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
          }, z.core.$strip>>>;
          defaultActiveViewId: z.ZodOptional<z.ZodString>;
          hideToolbar: z.ZodOptional<z.ZodBoolean>;
          kind: z.ZodLiteral<"kanban">;
          createRow: z.ZodOptional<z.ZodObject<{
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
            title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            submitLabel: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            columnParam: z.ZodOptional<z.ZodString>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            attributesParam: z.ZodOptional<z.ZodString>;
            attachments: z.ZodOptional<z.ZodObject<{
              command: z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"command">;
                id: z.ZodString;
              }, z.core.$strip>;
              resourceParam: z.ZodString;
              fileParam: z.ZodString;
            }, z.core.$strip>>;
            labels: z.ZodOptional<z.ZodObject<{
              cancel: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                $l10n: z.ZodString;
                default: z.ZodOptional<z.ZodString>;
              }, z.core.$strip>]>>;
              properties: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                $l10n: z.ZodString;
                default: z.ZodOptional<z.ZodString>;
              }, z.core.$strip>]>>;
              submitError: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                $l10n: z.ZodString;
                default: z.ZodOptional<z.ZodString>;
              }, z.core.$strip>]>>;
              removeFile: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                $l10n: z.ZodString;
                default: z.ZodOptional<z.ZodString>;
              }, z.core.$strip>]>>;
            }, z.core.$strip>>;
          }, z.core.$strip>>;
          rowActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
          toolbarActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            presentation: z.ZodOptional<z.ZodEnum<{
              primary: "primary";
              secondary: "secondary";
            }>>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
              type: z.ZodString;
            }, z.core.$catchall<z.ZodUnknown>>>>;
            submitLabel: z.ZodOptional<z.ZodString>;
            when: z.ZodOptional<z.ZodString>;
            disabled: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          columns: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            type: z.ZodOptional<z.ZodEnum<{
              boolean: "boolean";
              date: "date";
              number: "number";
              string: "string";
            }>>;
            groupable: z.ZodOptional<z.ZodBoolean>;
            filterable: z.ZodOptional<z.ZodBoolean>;
            description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            icon: z.ZodOptional<z.ZodString>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            stat: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
              type: z.ZodLiteral<"unique">;
            }, z.core.$strip>, z.ZodObject<{
              type: z.ZodLiteral<"histogram">;
              bins: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
              type: z.ZodLiteral<"top-values">;
              limit: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>], "type">>;
            renderer: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
              type: z.ZodLiteral<"json">;
            }, z.core.$strip>, z.ZodObject<{
              type: z.ZodLiteral<"color-scale">;
              stops: z.ZodArray<z.ZodObject<{
                value: z.ZodNumber;
                color: z.ZodObject<{
                  light: z.ZodString;
                  dark: z.ZodString;
                  foreground: z.ZodOptional<z.ZodObject<{
                    light: z.ZodString;
                    dark: z.ZodString;
                  }, z.core.$strip>>;
                }, z.core.$strip>;
              }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
              type: z.ZodLiteral<"categorical-color">;
              categories: z.ZodArray<z.ZodObject<{
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
                color: z.ZodObject<{
                  light: z.ZodString;
                  dark: z.ZodString;
                  foreground: z.ZodOptional<z.ZodObject<{
                    light: z.ZodString;
                    dark: z.ZodString;
                  }, z.core.$strip>>;
                }, z.core.$strip>;
              }, z.core.$strip>>;
            }, z.core.$strip>], "type">>;
          }, z.core.$strip>>>;
          queryHandlerId: z.ZodString;
          selectionMode: z.ZodOptional<z.ZodEnum<{
            multiple: "multiple";
            none: "none";
          }>>;
          rowActivationHandlerId: z.ZodOptional<z.ZodString>;
          initialPageSize: z.ZodOptional<z.ZodNumber>;
          pageSizeOptions: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
          defaultSettings: z.ZodOptional<z.ZodObject<{
            grouping: z.ZodOptional<z.ZodString>;
            rowNumbers: z.ZodOptional<z.ZodBoolean>;
            wrapRows: z.ZodOptional<z.ZodBoolean>;
            showStats: z.ZodOptional<z.ZodBoolean>;
            hiddenColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
            columnOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>>;
          defaultFilter: z.ZodOptional<z.ZodObject<{
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
          defaultSorts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            attributeId: z.ZodString;
            direction: z.ZodEnum<{
              asc: "asc";
              desc: "desc";
            }>;
          }, z.core.$strip>>>;
          defaultViews: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            settings: z.ZodOptional<z.ZodObject<{
              grouping: z.ZodOptional<z.ZodString>;
              rowNumbers: z.ZodOptional<z.ZodBoolean>;
              wrapRows: z.ZodOptional<z.ZodBoolean>;
              showStats: z.ZodOptional<z.ZodBoolean>;
              hiddenColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
              columnOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
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
          }, z.core.$strip>>>;
          defaultActiveViewId: z.ZodOptional<z.ZodString>;
          kind: z.ZodLiteral<"dataTable">;
          selectionActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
          rowActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
          toolbarActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            presentation: z.ZodOptional<z.ZodEnum<{
              primary: "primary";
              secondary: "secondary";
            }>>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
              type: z.ZodString;
            }, z.core.$catchall<z.ZodUnknown>>>>;
            submitLabel: z.ZodOptional<z.ZodString>;
            when: z.ZodOptional<z.ZodString>;
            disabled: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
        }, z.core.$strip>], "kind">;
      }, z.core.$strip>>;
      viewMenus: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        owner: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        view: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        side: z.ZodEnum<{
          left: "left";
          right: "right";
        }>;
        group: z.ZodOptional<z.ZodString>;
        placement: z.ZodOptional<z.ZodEnum<{
          default: "default";
          first: "first";
          last: "last";
        }>>;
        hostTreeHeader: z.ZodOptional<z.ZodEnum<{
          default: "default";
          none: "none";
        }>>;
        hostTreeFooter: z.ZodOptional<z.ZodEnum<{
          default: "default";
          none: "none";
        }>>;
      }, z.core.$strip>>;
      placements: z.ZodArray<z.ZodObject<{
        mountStrategy: z.ZodOptional<z.ZodEnum<{
          active: "active";
          "keep-mounted": "keep-mounted";
        }>>;
        hiddenByDefault: z.ZodOptional<z.ZodBoolean>;
        headerBorderBottom: z.ZodOptional<z.ZodBoolean>;
        tab: z.ZodOptional<z.ZodObject<{
          queryHandlerId: z.ZodString;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        mode: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>;
        item: z.ZodDiscriminatedUnion<[z.ZodObject<{
          kind: z.ZodLiteral<"view">;
          view: z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>;
          presence: z.ZodEnum<{
            closed: "closed";
            fixed: "fixed";
            open: "open";
          }>;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"binding">;
          binding: z.ZodObject<{
            kinds: z.ZodArray<z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"resource-kind">;
              id: z.ZodString;
            }, z.core.$strip>>;
            view: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"view">;
              id: z.ZodString;
            }, z.core.$strip>;
            cardinality: z.ZodEnum<{
              many: "many";
              one: "one";
            }>;
            add: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
              kind: z.ZodLiteral<"panel">;
              panel: z.ZodUnion<readonly [z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"placement">;
                id: z.ZodString;
              }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"page-slot">;
                page: z.ZodObject<{
                  extensionId: z.ZodString;
                  kind: z.ZodLiteral<"page">;
                  id: z.ZodString;
                }, z.core.$strip>;
                id: z.ZodString;
              }, z.core.$strip>]>;
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
              open: z.ZodOptional<z.ZodEnum<{
                pin: "pin";
                preview: "preview";
              }>>;
            }, z.core.$strip>]>, z.ZodObject<{
              kind: z.ZodLiteral<"command">;
              target: z.ZodObject<{
                command: z.ZodObject<{
                  extensionId: z.ZodString;
                  kind: z.ZodLiteral<"command">;
                  id: z.ZodString;
                }, z.core.$strip>;
                params: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
              }, z.core.$strip>;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"href">;
              href: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"compound">;
              targets: z.ZodArray<z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
                kind: z.ZodLiteral<"panel">;
                panel: z.ZodUnion<readonly [z.ZodObject<{
                  extensionId: z.ZodString;
                  kind: z.ZodLiteral<"placement">;
                  id: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                  kind: z.ZodLiteral<"page-slot">;
                  page: z.ZodObject<{
                    extensionId: z.ZodString;
                    kind: z.ZodLiteral<"page">;
                    id: z.ZodString;
                  }, z.core.$strip>;
                  id: z.ZodString;
                }, z.core.$strip>]>;
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
                open: z.ZodOptional<z.ZodEnum<{
                  pin: "pin";
                  preview: "preview";
                }>>;
              }, z.core.$strip>]>>;
            }, z.core.$strip>]>>;
          }, z.core.$strict>;
        }, z.core.$strict>], "kind">;
        region: z.ZodEnum<{
          main: "main";
          secondary: "secondary";
          side: "side";
        }>;
        order: z.ZodOptional<z.ZodNumber>;
        movableTo: z.ZodOptional<z.ZodArray<z.ZodEnum<{
          main: "main";
          secondary: "secondary";
          side: "side";
        }>>>;
      }, z.core.$strip>>;
      resourceKinds: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        label: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        icon: z.ZodOptional<z.ZodString>;
        resolveCommand: z.ZodOptional<z.ZodString>;
        resolveManyCommand: z.ZodOptional<z.ZodString>;
        paths: z.ZodOptional<z.ZodArray<z.ZodObject<{
          prefix: z.ZodString;
          resolveCommand: z.ZodString;
        }, z.core.$strip>>>;
        menuSlots: z.ZodOptional<z.ZodArray<z.ZodObject<{
          id: z.ZodString;
          placement: z.ZodEnum<{
            "context-menu": "context-menu";
            "header-overflow": "header-overflow";
            "header-primary": "header-primary";
          }>;
          label: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          access: z.ZodEnum<{
            owner: "owner";
            public: "public";
          }>;
          order: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
      }, z.core.$strip>>;
      resourceHierarchyProviders: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        resourceKind: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"resource-kind">;
          id: z.ZodString;
        }, z.core.$strip>;
      }, z.core.$strip>>>;
      navigationItems: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        owner: z.ZodUnion<readonly [z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"page">;
          id: z.ZodString;
        }, z.core.$strip>]>;
        slot: z.ZodEnum<{
          content: "content";
          footer: "footer";
          header: "header";
        }>;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodOptional<z.ZodString>;
        group: z.ZodOptional<z.ZodString>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"mode">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"mode">;
            id: z.ZodString;
          }, z.core.$strip>>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          view: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"resource-kind">;
            id: z.ZodString;
          }, z.core.$strip>>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        action: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
          kind: z.ZodLiteral<"panel">;
          panel: z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"placement">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"page-slot">;
            page: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"page">;
              id: z.ZodString;
            }, z.core.$strip>;
            id: z.ZodString;
          }, z.core.$strip>]>;
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
          open: z.ZodOptional<z.ZodEnum<{
            pin: "pin";
            preview: "preview";
          }>>;
        }, z.core.$strip>]>, z.ZodObject<{
          kind: z.ZodLiteral<"command">;
          target: z.ZodObject<{
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
            params: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
          }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"href">;
          href: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"compound">;
          targets: z.ZodArray<z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
            kind: z.ZodLiteral<"panel">;
            panel: z.ZodUnion<readonly [z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"placement">;
              id: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"page-slot">;
              page: z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"page">;
                id: z.ZodString;
              }, z.core.$strip>;
              id: z.ZodString;
            }, z.core.$strip>]>;
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
            open: z.ZodOptional<z.ZodEnum<{
              pin: "pin";
              preview: "preview";
            }>>;
          }, z.core.$strip>]>>;
        }, z.core.$strip>]>;
      }, z.core.$strip>>;
      navigationTrees: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        owner: z.ZodUnion<readonly [z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"page">;
          id: z.ZodString;
        }, z.core.$strip>]>;
        slot: z.ZodEnum<{
          content: "content";
          footer: "footer";
          header: "header";
        }>;
        view: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        resourceScope: z.ZodOptional<z.ZodEnum<{
          project: "project";
          selection: "selection";
        }>>;
      }, z.core.$strip>>;
      statusBarItems: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        view: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        slot: z.ZodObject<{
          id: z.ZodString;
        }, z.core.$strip>;
        order: z.ZodOptional<z.ZodNumber>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"mode">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"mode">;
            id: z.ZodString;
          }, z.core.$strip>>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          view: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"resource-kind">;
            id: z.ZodString;
          }, z.core.$strip>>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
      }, z.core.$strip>>;
      activityItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodString;
        modes: z.ZodArray<z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>>;
        placement: z.ZodOptional<z.ZodEnum<{
          default: "default";
          first: "first";
          last: "last";
        }>>;
        command: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"command">;
          id: z.ZodString;
        }, z.core.$strip>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
      }, z.core.$strip>>>;
      settingsSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        scope: z.ZodOptional<z.ZodEnum<{
          global: "global";
          project: "project";
        }>>;
        order: z.ZodOptional<z.ZodNumber>;
      }, z.core.$strip>>>;
      settingsPanels: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        view: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        slot: z.ZodObject<{
          id: z.ZodString;
        }, z.core.$strip>;
        section: z.ZodOptional<z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"settings-section">;
          id: z.ZodString;
        }, z.core.$strip>>;
      }, z.core.$strip>>;
      commandPaletteResources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        resourceKind: z.ZodOptional<z.ZodString>;
        queryHandlerId: z.ZodString;
        refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
      }, z.core.$strip>>>;
      keybindings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        action: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
          kind: z.ZodLiteral<"panel">;
          panel: z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"placement">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"page-slot">;
            page: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"page">;
              id: z.ZodString;
            }, z.core.$strip>;
            id: z.ZodString;
          }, z.core.$strip>]>;
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
          open: z.ZodOptional<z.ZodEnum<{
            pin: "pin";
            preview: "preview";
          }>>;
        }, z.core.$strip>]>, z.ZodObject<{
          kind: z.ZodLiteral<"command">;
          target: z.ZodObject<{
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
            params: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
          }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"href">;
          href: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"compound">;
          targets: z.ZodArray<z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
            kind: z.ZodLiteral<"panel">;
            panel: z.ZodUnion<readonly [z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"placement">;
              id: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"page-slot">;
              page: z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"page">;
                id: z.ZodString;
              }, z.core.$strip>;
              id: z.ZodString;
            }, z.core.$strip>]>;
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
            open: z.ZodOptional<z.ZodEnum<{
              pin: "pin";
              preview: "preview";
            }>>;
          }, z.core.$strip>]>>;
        }, z.core.$strip>]>;
        key: z.ZodString;
        canonicalChord: z.ZodString;
        parsed: z.ZodObject<{
          key: z.ZodString;
          ctrl: z.ZodBoolean;
          shift: z.ZodBoolean;
          alt: z.ZodBoolean;
          meta: z.ZodBoolean;
          modifiers: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        platformOverrides: z.ZodOptional<z.ZodObject<{
          mac: z.ZodOptional<z.ZodString>;
          linux: z.ZodOptional<z.ZodString>;
          win: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          viewId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodString>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
      }, z.core.$strip>>>;
      settingsDefinitions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        extensionId: z.ZodString;
        type: z.ZodEnum<{
          array: "array";
          boolean: "boolean";
          number: "number";
          object: "object";
          string: "string";
        }>;
        scope: z.ZodEnum<{
          global: "global";
          project: "project";
        }>;
        default: z.ZodOptional<z.ZodUnknown>;
        enum: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        options: z.ZodOptional<z.ZodObject<{
          commandId: z.ZodString;
          valueField: z.ZodString;
          labelField: z.ZodString;
          params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
      }, z.core.$strip>>>;
      diagnostics: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        severity: z.ZodEnum<{
          error: "error";
          info: "info";
          warning: "warning";
        }>;
        message: z.ZodString;
        extensionId: z.ZodOptional<z.ZodString>;
        commandId: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
      }, z.core.$strip>>;
      extensionsRoot: z.ZodString;
      extensionsRootExists: z.ZodBoolean;
      errorCount: z.ZodNumber;
      warningCount: z.ZodNumber;
      middlewares: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        commandId: z.ZodString;
      }, z.core.$strip>>;
      hooks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        eventId: z.ZodString;
      }, z.core.$strip>>;
      schedules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        cron: z.ZodString;
        commandId: z.ZodString;
      }, z.core.$strip>>;
      artifactMounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        relativePath: z.ZodString;
        fullPath: z.ZodString;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        watch: z.ZodBoolean;
      }, z.core.$strip>>;
      themes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        format: z.ZodLiteral<"vscode-color-theme">;
        mode: z.ZodEnum<{
          dark: "dark";
          light: "light";
        }>;
        source: z.ZodObject<{
          kind: z.ZodLiteral<"package-asset">;
          path: z.ZodString;
          baseUrl: z.ZodString;
        }, z.core.$strip>;
        tokens: z.ZodRecord<z.ZodString, z.ZodString>;
        monacoTheme: z.ZodObject<{
          base: z.ZodEnum<{
            vs: "vs";
            "vs-dark": "vs-dark";
          }>;
          inherit: z.ZodLiteral<true>;
          rules: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
          colors: z.ZodRecord<z.ZodString, z.ZodString>;
        }, z.core.$strip>;
      }, z.core.$strip>>;
      fileIconThemes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        format: z.ZodLiteral<"vscode-file-icon-theme">;
        source: z.ZodObject<{
          kind: z.ZodLiteral<"package-asset">;
          path: z.ZodString;
          baseUrl: z.ZodString;
        }, z.core.$strip>;
        definitions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        fileExtensions: z.ZodRecord<z.ZodString, z.ZodString>;
        fileNames: z.ZodRecord<z.ZodString, z.ZodString>;
        defaults: z.ZodDefault<z.ZodObject<{
          file: z.ZodOptional<z.ZodString>;
          folder: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        fonts: z.ZodDefault<z.ZodArray<z.ZodObject<{
          fontFamily: z.ZodString;
          src: z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            format: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>>;
          weight: z.ZodOptional<z.ZodString>;
          style: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
      }, z.core.$strip>>;
      templates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
      }, z.core.$strip>>;
      skills: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
      }, z.core.$strip>>;
      hostCompatibility: z.ZodObject<{
        status: z.ZodEnum<{
          unverified: "unverified";
          verified: "verified";
        }>;
        host: z.ZodOptional<z.ZodObject<{
          host: z.ZodLiteral<"dashboard">;
          hostVersion: z.ZodString;
          capabilities: z.ZodRecord<z.ZodString, z.ZodObject<{
            version: z.ZodNumber;
            since: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>>;
        }, z.core.$strip>>;
        diagnostics: z.ZodArray<z.ZodObject<{
          code: z.ZodString;
          severity: z.ZodEnum<{
            error: "error";
            info: "info";
            warning: "warning";
          }>;
          message: z.ZodString;
          extensionId: z.ZodOptional<z.ZodString>;
          commandId: z.ZodOptional<z.ZodString>;
          sourcePath: z.ZodOptional<z.ZodString>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
      }, z.core.$strip>;
    }, z.core.$strip>;
    installName: z.ZodString;
    manifest: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    metadata: z.ZodObject<{
      id: z.ZodString;
      name: z.ZodString;
      displayName: z.ZodString;
      version: z.ZodString;
      description: z.ZodOptional<z.ZodString>;
      enginesPstdio: z.ZodString;
    }, z.core.$strip>;
    source: z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"local">;
      path: z.ZodString;
      ref: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
      kind: z.ZodLiteral<"named">;
      name: z.ZodString;
      ref: z.ZodString;
    }, z.core.$strip>], "kind">;
    sourceHash: z.ZodString;
    targetPath: z.ZodString;
  }, z.core.$strip>;
  extension: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    extensionId: z.ZodString;
    installedExtensionId: z.ZodString;
    installName: z.ZodString;
    name: z.ZodString;
    displayName: z.ZodString;
    version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodString;
    scope: z.ZodEnum<{
      global: "global";
      repo: "repo";
    }>;
    status: z.ZodEnum<{
      disabled: "disabled";
      error: "error";
      loaded: "loaded";
      missing: "missing";
      pending: "pending";
    }>;
    lastLoadedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastError: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    enabled: z.ZodBoolean;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    canUpgrade: z.ZodBoolean;
    updateAvailable: z.ZodBoolean;
  }, z.core.$strip>;
}, z.core.$strip>;
declare const extensionDiagnosticsResponseSchema: z.ZodObject<{
  roots: z.ZodArray<z.ZodObject<{
    scope: z.ZodEnum<{
      repo: "repo";
      user: "user";
    }>;
    path: z.ZodString;
    check: z.ZodObject<{
      extensions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        displayName: z.ZodString;
        extensionInstanceId: z.ZodOptional<z.ZodString>;
        installedExtensionId: z.ZodOptional<z.ZodString>;
        installName: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodString;
      }, z.core.$strip>>;
      commands: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        cliPath: z.ZodOptional<z.ZodString>;
        cliAliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
        examples: z.ZodOptional<z.ZodArray<z.ZodString>>;
        automation: z.ZodOptional<z.ZodBoolean>;
        mutating: z.ZodOptional<z.ZodBoolean>;
        resourceMutation: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
          kind: z.ZodLiteral<"rename">;
          resourceType: z.ZodString;
          idParam: z.ZodString;
          labelParam: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"remove">;
          resourceType: z.ZodString;
          idParam: z.ZodString;
        }, z.core.$strip>], "kind">>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
          type: z.ZodString;
        }, z.core.$catchall<z.ZodUnknown>>>>;
      }, z.core.$strip>>;
      menuContributions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        commandId: z.ZodString;
        slotId: z.ZodString;
        target: z.ZodOptional<z.ZodEnum<{
          "workbench.nav.actions": "workbench.nav.actions";
          "workbench.nav.overflow": "workbench.nav.overflow";
        }>>;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        group: z.ZodOptional<z.ZodString>;
        placement: z.ZodOptional<z.ZodEnum<{
          default: "default";
          first: "first";
          last: "last";
        }>>;
        icon: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodEnum<{
          button: "button";
          "icon-button": "icon-button";
          "menu-item": "menu-item";
        }>>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          viewId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodString>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        disabledWhen: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          viewId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodString>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        disabledReason: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
      }, z.core.$strip>>;
      commandPaletteContributions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        commandId: z.ZodString;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        group: z.ZodOptional<z.ZodString>;
        placement: z.ZodOptional<z.ZodEnum<{
          default: "default";
          first: "first";
          last: "last";
        }>>;
        icon: z.ZodOptional<z.ZodString>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          viewId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodString>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
      }, z.core.$strip>>>;
      modes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodOptional<z.ZodString>;
        regions: z.ZodArray<z.ZodEnum<{
          main: "main";
          secondary: "secondary";
          side: "side";
        }>>;
        floatingPanels: z.ZodOptional<z.ZodEnum<{
          hidden: "hidden";
          visible: "visible";
        }>>;
        regionSettings: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
          main: "main";
          secondary: "secondary";
          side: "side";
          sidenav: "sidenav";
        }> & z.core.$partial, z.ZodObject<{
          showHeader: z.ZodOptional<z.ZodBoolean>;
          size: z.ZodOptional<z.ZodObject<{
            defaultPx: z.ZodOptional<z.ZodNumber>;
            minPx: z.ZodOptional<z.ZodNumber>;
            maxPx: z.ZodOptional<z.ZodNumber>;
          }, z.core.$strip>>;
          collapsible: z.ZodOptional<z.ZodBoolean>;
          alwaysShowTabs: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        defaultTheme: z.ZodOptional<z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"theme">;
          id: z.ZodString;
        }, z.core.$strip>>;
        chrome: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
          activity: "activity";
          nav: "nav";
          sidenav: "sidenav";
          status: "status";
        }> & z.core.$partial, z.ZodUnion<readonly [z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>, z.ZodLiteral<false>]>>>;
      }, z.core.$strip>>;
      pages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
          type: z.ZodLiteral<"string">;
          default: z.ZodOptional<z.ZodString>;
          values: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        }, z.core.$strict>, z.ZodObject<{
          type: z.ZodLiteral<"number">;
          default: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
          type: z.ZodLiteral<"boolean">;
          default: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
          type: z.ZodLiteral<"string[]">;
          default: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        }, z.core.$strict>], "type">>>;
        document: z.ZodOptional<z.ZodObject<{
          metadataKey: z.ZodString;
        }, z.core.$strip>>;
        mode: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>;
        parent: z.ZodOptional<z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"page">;
          id: z.ZodString;
        }, z.core.$strip>>;
        resource: z.ZodOptional<z.ZodObject<{
          kinds: z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"resource-kind">;
            id: z.ZodString;
          }, z.core.$strip>>;
        }, z.core.$strict>>;
        main: z.ZodDiscriminatedUnion<[z.ZodObject<{
          mountStrategy: z.ZodOptional<z.ZodEnum<{
            active: "active";
            "keep-mounted": "keep-mounted";
          }>>;
          hiddenByDefault: z.ZodOptional<z.ZodBoolean>;
          headerBorderBottom: z.ZodOptional<z.ZodBoolean>;
          tab: z.ZodOptional<z.ZodObject<{
            queryHandlerId: z.ZodString;
            refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>>;
          kind: z.ZodLiteral<"view">;
          view: z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>;
          cardinality: z.ZodEnum<{
            many: "many";
            one: "one";
          }>;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"panels">;
          empty: z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>;
        }, z.core.$strict>], "kind">;
        slots: z.ZodArray<z.ZodObject<{
          mountStrategy: z.ZodOptional<z.ZodEnum<{
            active: "active";
            "keep-mounted": "keep-mounted";
          }>>;
          hiddenByDefault: z.ZodOptional<z.ZodBoolean>;
          headerBorderBottom: z.ZodOptional<z.ZodBoolean>;
          tab: z.ZodOptional<z.ZodObject<{
            queryHandlerId: z.ZodString;
            refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>>;
          id: z.ZodString;
          region: z.ZodEnum<{
            main: "main";
            secondary: "secondary";
            side: "side";
          }>;
          order: z.ZodOptional<z.ZodNumber>;
          item: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"view">;
            view: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"view">;
              id: z.ZodString;
            }, z.core.$strip>;
            presence: z.ZodEnum<{
              closed: "closed";
              fixed: "fixed";
              open: "open";
            }>;
          }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"binding">;
            binding: z.ZodObject<{
              kinds: z.ZodArray<z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"resource-kind">;
                id: z.ZodString;
              }, z.core.$strip>>;
              view: z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"view">;
                id: z.ZodString;
              }, z.core.$strip>;
              cardinality: z.ZodEnum<{
                many: "many";
                one: "one";
              }>;
              add: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
                kind: z.ZodLiteral<"panel">;
                panel: z.ZodUnion<readonly [z.ZodObject<{
                  extensionId: z.ZodString;
                  kind: z.ZodLiteral<"placement">;
                  id: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                  kind: z.ZodLiteral<"page-slot">;
                  page: z.ZodObject<{
                    extensionId: z.ZodString;
                    kind: z.ZodLiteral<"page">;
                    id: z.ZodString;
                  }, z.core.$strip>;
                  id: z.ZodString;
                }, z.core.$strip>]>;
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
                open: z.ZodOptional<z.ZodEnum<{
                  pin: "pin";
                  preview: "preview";
                }>>;
              }, z.core.$strip>]>, z.ZodObject<{
                kind: z.ZodLiteral<"command">;
                target: z.ZodObject<{
                  command: z.ZodObject<{
                    extensionId: z.ZodString;
                    kind: z.ZodLiteral<"command">;
                    id: z.ZodString;
                  }, z.core.$strip>;
                  params: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
                }, z.core.$strip>;
              }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"href">;
                href: z.ZodString;
              }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"compound">;
                targets: z.ZodArray<z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
                  kind: z.ZodLiteral<"panel">;
                  panel: z.ZodUnion<readonly [z.ZodObject<{
                    extensionId: z.ZodString;
                    kind: z.ZodLiteral<"placement">;
                    id: z.ZodString;
                  }, z.core.$strip>, z.ZodObject<{
                    kind: z.ZodLiteral<"page-slot">;
                    page: z.ZodObject<{
                      extensionId: z.ZodString;
                      kind: z.ZodLiteral<"page">;
                      id: z.ZodString;
                    }, z.core.$strip>;
                    id: z.ZodString;
                  }, z.core.$strip>]>;
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
                  open: z.ZodOptional<z.ZodEnum<{
                    pin: "pin";
                    preview: "preview";
                  }>>;
                }, z.core.$strip>]>>;
              }, z.core.$strip>]>>;
            }, z.core.$strict>;
          }, z.core.$strict>], "kind">;
          openOn: z.ZodOptional<z.ZodLiteral<"page-resource">>;
        }, z.core.$strict>>;
      }, z.core.$strip>>;
      views: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodOptional<z.ZodString>;
        body: z.ZodDiscriminatedUnion<[z.ZodObject<{
          kind: z.ZodLiteral<"webview">;
          webview: z.ZodObject<{
            entry: z.ZodObject<{
              kind: z.ZodLiteral<"package-asset">;
              path: z.ZodString;
              baseUrl: z.ZodString;
            }, z.core.$strip>;
            title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            capabilities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            runtimeUrl: z.ZodString;
            moduleUrl: z.ZodString;
            styles: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          searchable: z.ZodOptional<z.ZodBoolean>;
          searchPlaceholder: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          headerHandlerId: z.ZodOptional<z.ZodString>;
          bodyHandlerId: z.ZodString;
          childrenHandlerId: z.ZodOptional<z.ZodString>;
          moveHandlerId: z.ZodOptional<z.ZodString>;
          footerHandlerId: z.ZodOptional<z.ZodString>;
          defaultExpandedSectionIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          defaultExpandedNodeIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          kind: z.ZodLiteral<"tree">;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          loadHandlerId: z.ZodString;
          saveHandlerId: z.ZodOptional<z.ZodString>;
          kind: z.ZodLiteral<"file">;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          queryHandlerId: z.ZodString;
          valueChangeHandlerId: z.ZodOptional<z.ZodString>;
          applyHandlerId: z.ZodOptional<z.ZodString>;
          resetHandlerId: z.ZodOptional<z.ZodString>;
          defaultValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>, z.ZodArray<z.ZodString>, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
          }, z.core.$strict>, z.ZodObject<{
            harnessId: z.ZodString;
            model: z.ZodOptional<z.ZodString>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>>;
          }, z.core.$strict>]>>>;
          kind: z.ZodLiteral<"controls">;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          extensionInstanceId: z.ZodOptional<z.ZodString>;
          attributes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            type: z.ZodDiscriminatedUnion<[z.ZodObject<{
              kind: z.ZodLiteral<"enum">;
              options: z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                  $l10n: z.ZodString;
                  default: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>]>;
                color: z.ZodOptional<z.ZodString>;
                icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
              }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"enum-multi">;
              options: z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                  $l10n: z.ZodString;
                  default: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>]>;
                color: z.ZodOptional<z.ZodString>;
                icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
              }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"boolean">;
              legacyValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"string">;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"date">;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"number">;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"user">;
            }, z.core.$strip>], "kind">;
            filterable: z.ZodOptional<z.ZodBoolean>;
            groupable: z.ZodOptional<z.ZodBoolean>;
            sortable: z.ZodOptional<z.ZodBoolean>;
            displayable: z.ZodOptional<z.ZodBoolean>;
            editable: z.ZodOptional<z.ZodBoolean>;
            display: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
              kind: z.ZodLiteral<"badge-list">;
              itemsAttributeId: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodString;
            }, z.core.$loose>]>>;
          }, z.core.$strip>>>;
          queryHandlerId: z.ZodString;
          attributeChangeHandlerId: z.ZodOptional<z.ZodString>;
          moveHandlerId: z.ZodOptional<z.ZodString>;
          schemaRefreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          columnActionHandlerId: z.ZodOptional<z.ZodString>;
          rowActivationHandlerId: z.ZodOptional<z.ZodString>;
          defaultSettings: z.ZodOptional<z.ZodObject<{
            viewMode: z.ZodOptional<z.ZodEnum<{
              board: "board";
              list: "list";
            }>>;
            columnGrouping: z.ZodOptional<z.ZodString>;
            rowGrouping: z.ZodOptional<z.ZodString>;
            displayProperties: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>>;
          defaultFilter: z.ZodOptional<z.ZodObject<{
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
          defaultSorts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            attributeId: z.ZodString;
            direction: z.ZodEnum<{
              asc: "asc";
              desc: "desc";
            }>;
          }, z.core.$strip>>>;
          defaultViews: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            settings: z.ZodObject<{
              viewMode: z.ZodEnum<{
                board: "board";
                list: "list";
              }>;
              columnGrouping: z.ZodString;
              rowGrouping: z.ZodString;
              displayProperties: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
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
          }, z.core.$strip>>>;
          defaultActiveViewId: z.ZodOptional<z.ZodString>;
          hideToolbar: z.ZodOptional<z.ZodBoolean>;
          kind: z.ZodLiteral<"kanban">;
          createRow: z.ZodOptional<z.ZodObject<{
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
            title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            submitLabel: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            columnParam: z.ZodOptional<z.ZodString>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            attributesParam: z.ZodOptional<z.ZodString>;
            attachments: z.ZodOptional<z.ZodObject<{
              command: z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"command">;
                id: z.ZodString;
              }, z.core.$strip>;
              resourceParam: z.ZodString;
              fileParam: z.ZodString;
            }, z.core.$strip>>;
            labels: z.ZodOptional<z.ZodObject<{
              cancel: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                $l10n: z.ZodString;
                default: z.ZodOptional<z.ZodString>;
              }, z.core.$strip>]>>;
              properties: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                $l10n: z.ZodString;
                default: z.ZodOptional<z.ZodString>;
              }, z.core.$strip>]>>;
              submitError: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                $l10n: z.ZodString;
                default: z.ZodOptional<z.ZodString>;
              }, z.core.$strip>]>>;
              removeFile: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                $l10n: z.ZodString;
                default: z.ZodOptional<z.ZodString>;
              }, z.core.$strip>]>>;
            }, z.core.$strip>>;
          }, z.core.$strip>>;
          rowActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
          toolbarActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            presentation: z.ZodOptional<z.ZodEnum<{
              primary: "primary";
              secondary: "secondary";
            }>>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
              type: z.ZodString;
            }, z.core.$catchall<z.ZodUnknown>>>>;
            submitLabel: z.ZodOptional<z.ZodString>;
            when: z.ZodOptional<z.ZodString>;
            disabled: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
        }, z.core.$strip>, z.ZodObject<{
          resourceKind: z.ZodOptional<z.ZodString>;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
          emptyTitle: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          emptyDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          columns: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            type: z.ZodOptional<z.ZodEnum<{
              boolean: "boolean";
              date: "date";
              number: "number";
              string: "string";
            }>>;
            groupable: z.ZodOptional<z.ZodBoolean>;
            filterable: z.ZodOptional<z.ZodBoolean>;
            description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>>;
            icon: z.ZodOptional<z.ZodString>;
            hidden: z.ZodOptional<z.ZodBoolean>;
            stat: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
              type: z.ZodLiteral<"unique">;
            }, z.core.$strip>, z.ZodObject<{
              type: z.ZodLiteral<"histogram">;
              bins: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
              type: z.ZodLiteral<"top-values">;
              limit: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>], "type">>;
            renderer: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
              type: z.ZodLiteral<"json">;
            }, z.core.$strip>, z.ZodObject<{
              type: z.ZodLiteral<"color-scale">;
              stops: z.ZodArray<z.ZodObject<{
                value: z.ZodNumber;
                color: z.ZodObject<{
                  light: z.ZodString;
                  dark: z.ZodString;
                  foreground: z.ZodOptional<z.ZodObject<{
                    light: z.ZodString;
                    dark: z.ZodString;
                  }, z.core.$strip>>;
                }, z.core.$strip>;
              }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
              type: z.ZodLiteral<"categorical-color">;
              categories: z.ZodArray<z.ZodObject<{
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
                color: z.ZodObject<{
                  light: z.ZodString;
                  dark: z.ZodString;
                  foreground: z.ZodOptional<z.ZodObject<{
                    light: z.ZodString;
                    dark: z.ZodString;
                  }, z.core.$strip>>;
                }, z.core.$strip>;
              }, z.core.$strip>>;
            }, z.core.$strip>], "type">>;
          }, z.core.$strip>>>;
          queryHandlerId: z.ZodString;
          selectionMode: z.ZodOptional<z.ZodEnum<{
            multiple: "multiple";
            none: "none";
          }>>;
          rowActivationHandlerId: z.ZodOptional<z.ZodString>;
          initialPageSize: z.ZodOptional<z.ZodNumber>;
          pageSizeOptions: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
          defaultSettings: z.ZodOptional<z.ZodObject<{
            grouping: z.ZodOptional<z.ZodString>;
            rowNumbers: z.ZodOptional<z.ZodBoolean>;
            wrapRows: z.ZodOptional<z.ZodBoolean>;
            showStats: z.ZodOptional<z.ZodBoolean>;
            hiddenColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
            columnOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
          }, z.core.$strip>>;
          defaultFilter: z.ZodOptional<z.ZodObject<{
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
          defaultSorts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            attributeId: z.ZodString;
            direction: z.ZodEnum<{
              asc: "asc";
              desc: "desc";
            }>;
          }, z.core.$strip>>>;
          defaultViews: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            settings: z.ZodOptional<z.ZodObject<{
              grouping: z.ZodOptional<z.ZodString>;
              rowNumbers: z.ZodOptional<z.ZodBoolean>;
              wrapRows: z.ZodOptional<z.ZodBoolean>;
              showStats: z.ZodOptional<z.ZodBoolean>;
              hiddenColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
              columnOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
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
          }, z.core.$strip>>>;
          defaultActiveViewId: z.ZodOptional<z.ZodString>;
          kind: z.ZodLiteral<"dataTable">;
          selectionActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
          rowActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
          toolbarActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
              $l10n: z.ZodString;
              default: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            icon: z.ZodOptional<z.ZodString>;
            presentation: z.ZodOptional<z.ZodEnum<{
              primary: "primary";
              secondary: "secondary";
            }>>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
              type: z.ZodString;
            }, z.core.$catchall<z.ZodUnknown>>>>;
            submitLabel: z.ZodOptional<z.ZodString>;
            when: z.ZodOptional<z.ZodString>;
            disabled: z.ZodOptional<z.ZodBoolean>;
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
          }, z.core.$strip>>>;
        }, z.core.$strip>], "kind">;
      }, z.core.$strip>>;
      viewMenus: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        owner: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        view: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        side: z.ZodEnum<{
          left: "left";
          right: "right";
        }>;
        group: z.ZodOptional<z.ZodString>;
        placement: z.ZodOptional<z.ZodEnum<{
          default: "default";
          first: "first";
          last: "last";
        }>>;
        hostTreeHeader: z.ZodOptional<z.ZodEnum<{
          default: "default";
          none: "none";
        }>>;
        hostTreeFooter: z.ZodOptional<z.ZodEnum<{
          default: "default";
          none: "none";
        }>>;
      }, z.core.$strip>>;
      placements: z.ZodArray<z.ZodObject<{
        mountStrategy: z.ZodOptional<z.ZodEnum<{
          active: "active";
          "keep-mounted": "keep-mounted";
        }>>;
        hiddenByDefault: z.ZodOptional<z.ZodBoolean>;
        headerBorderBottom: z.ZodOptional<z.ZodBoolean>;
        tab: z.ZodOptional<z.ZodObject<{
          queryHandlerId: z.ZodString;
          refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        mode: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>;
        item: z.ZodDiscriminatedUnion<[z.ZodObject<{
          kind: z.ZodLiteral<"view">;
          view: z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>;
          presence: z.ZodEnum<{
            closed: "closed";
            fixed: "fixed";
            open: "open";
          }>;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"binding">;
          binding: z.ZodObject<{
            kinds: z.ZodArray<z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"resource-kind">;
              id: z.ZodString;
            }, z.core.$strip>>;
            view: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"view">;
              id: z.ZodString;
            }, z.core.$strip>;
            cardinality: z.ZodEnum<{
              many: "many";
              one: "one";
            }>;
            add: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
              kind: z.ZodLiteral<"panel">;
              panel: z.ZodUnion<readonly [z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"placement">;
                id: z.ZodString;
              }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"page-slot">;
                page: z.ZodObject<{
                  extensionId: z.ZodString;
                  kind: z.ZodLiteral<"page">;
                  id: z.ZodString;
                }, z.core.$strip>;
                id: z.ZodString;
              }, z.core.$strip>]>;
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
              open: z.ZodOptional<z.ZodEnum<{
                pin: "pin";
                preview: "preview";
              }>>;
            }, z.core.$strip>]>, z.ZodObject<{
              kind: z.ZodLiteral<"command">;
              target: z.ZodObject<{
                command: z.ZodObject<{
                  extensionId: z.ZodString;
                  kind: z.ZodLiteral<"command">;
                  id: z.ZodString;
                }, z.core.$strip>;
                params: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
              }, z.core.$strip>;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"href">;
              href: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"compound">;
              targets: z.ZodArray<z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
                kind: z.ZodLiteral<"panel">;
                panel: z.ZodUnion<readonly [z.ZodObject<{
                  extensionId: z.ZodString;
                  kind: z.ZodLiteral<"placement">;
                  id: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                  kind: z.ZodLiteral<"page-slot">;
                  page: z.ZodObject<{
                    extensionId: z.ZodString;
                    kind: z.ZodLiteral<"page">;
                    id: z.ZodString;
                  }, z.core.$strip>;
                  id: z.ZodString;
                }, z.core.$strip>]>;
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
                open: z.ZodOptional<z.ZodEnum<{
                  pin: "pin";
                  preview: "preview";
                }>>;
              }, z.core.$strip>]>>;
            }, z.core.$strip>]>>;
          }, z.core.$strict>;
        }, z.core.$strict>], "kind">;
        region: z.ZodEnum<{
          main: "main";
          secondary: "secondary";
          side: "side";
        }>;
        order: z.ZodOptional<z.ZodNumber>;
        movableTo: z.ZodOptional<z.ZodArray<z.ZodEnum<{
          main: "main";
          secondary: "secondary";
          side: "side";
        }>>>;
      }, z.core.$strip>>;
      resourceKinds: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        localId: z.ZodString;
        extensionId: z.ZodString;
        label: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        icon: z.ZodOptional<z.ZodString>;
        resolveCommand: z.ZodOptional<z.ZodString>;
        resolveManyCommand: z.ZodOptional<z.ZodString>;
        paths: z.ZodOptional<z.ZodArray<z.ZodObject<{
          prefix: z.ZodString;
          resolveCommand: z.ZodString;
        }, z.core.$strip>>>;
        menuSlots: z.ZodOptional<z.ZodArray<z.ZodObject<{
          id: z.ZodString;
          placement: z.ZodEnum<{
            "context-menu": "context-menu";
            "header-overflow": "header-overflow";
            "header-primary": "header-primary";
          }>;
          label: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            $l10n: z.ZodString;
            default: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>]>>;
          access: z.ZodEnum<{
            owner: "owner";
            public: "public";
          }>;
          order: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
      }, z.core.$strip>>;
      resourceHierarchyProviders: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        resourceKind: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"resource-kind">;
          id: z.ZodString;
        }, z.core.$strip>;
      }, z.core.$strip>>>;
      navigationItems: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        owner: z.ZodUnion<readonly [z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"page">;
          id: z.ZodString;
        }, z.core.$strip>]>;
        slot: z.ZodEnum<{
          content: "content";
          footer: "footer";
          header: "header";
        }>;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodOptional<z.ZodString>;
        group: z.ZodOptional<z.ZodString>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"mode">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"mode">;
            id: z.ZodString;
          }, z.core.$strip>>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          view: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"resource-kind">;
            id: z.ZodString;
          }, z.core.$strip>>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        action: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
          kind: z.ZodLiteral<"panel">;
          panel: z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"placement">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"page-slot">;
            page: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"page">;
              id: z.ZodString;
            }, z.core.$strip>;
            id: z.ZodString;
          }, z.core.$strip>]>;
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
          open: z.ZodOptional<z.ZodEnum<{
            pin: "pin";
            preview: "preview";
          }>>;
        }, z.core.$strip>]>, z.ZodObject<{
          kind: z.ZodLiteral<"command">;
          target: z.ZodObject<{
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
            params: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
          }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"href">;
          href: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"compound">;
          targets: z.ZodArray<z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
            kind: z.ZodLiteral<"panel">;
            panel: z.ZodUnion<readonly [z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"placement">;
              id: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"page-slot">;
              page: z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"page">;
                id: z.ZodString;
              }, z.core.$strip>;
              id: z.ZodString;
            }, z.core.$strip>]>;
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
            open: z.ZodOptional<z.ZodEnum<{
              pin: "pin";
              preview: "preview";
            }>>;
          }, z.core.$strip>]>>;
        }, z.core.$strip>]>;
      }, z.core.$strip>>;
      navigationTrees: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        owner: z.ZodUnion<readonly [z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"page">;
          id: z.ZodString;
        }, z.core.$strip>]>;
        slot: z.ZodEnum<{
          content: "content";
          footer: "footer";
          header: "header";
        }>;
        view: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        resourceScope: z.ZodOptional<z.ZodEnum<{
          project: "project";
          selection: "selection";
        }>>;
      }, z.core.$strip>>;
      statusBarItems: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        view: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        slot: z.ZodObject<{
          id: z.ZodString;
        }, z.core.$strip>;
        order: z.ZodOptional<z.ZodNumber>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"mode">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"mode">;
            id: z.ZodString;
          }, z.core.$strip>>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          view: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"view">;
            id: z.ZodString;
          }, z.core.$strip>>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"resource-kind">;
            id: z.ZodString;
          }, z.core.$strip>>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
      }, z.core.$strip>>;
      activityItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        icon: z.ZodString;
        modes: z.ZodArray<z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"mode">;
          id: z.ZodString;
        }, z.core.$strip>>;
        placement: z.ZodOptional<z.ZodEnum<{
          default: "default";
          first: "first";
          last: "last";
        }>>;
        command: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"command">;
          id: z.ZodString;
        }, z.core.$strip>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
      }, z.core.$strip>>>;
      settingsSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        scope: z.ZodOptional<z.ZodEnum<{
          global: "global";
          project: "project";
        }>>;
        order: z.ZodOptional<z.ZodNumber>;
      }, z.core.$strip>>>;
      settingsPanels: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        view: z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"view">;
          id: z.ZodString;
        }, z.core.$strip>;
        slot: z.ZodObject<{
          id: z.ZodString;
        }, z.core.$strip>;
        section: z.ZodOptional<z.ZodObject<{
          extensionId: z.ZodString;
          kind: z.ZodLiteral<"settings-section">;
          id: z.ZodString;
        }, z.core.$strip>>;
      }, z.core.$strip>>;
      commandPaletteResources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        resourceKind: z.ZodOptional<z.ZodString>;
        queryHandlerId: z.ZodString;
        refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
      }, z.core.$strip>>>;
      keybindings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        action: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
          kind: z.ZodLiteral<"panel">;
          panel: z.ZodUnion<readonly [z.ZodObject<{
            extensionId: z.ZodString;
            kind: z.ZodLiteral<"placement">;
            id: z.ZodString;
          }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"page-slot">;
            page: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"page">;
              id: z.ZodString;
            }, z.core.$strip>;
            id: z.ZodString;
          }, z.core.$strip>]>;
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
          open: z.ZodOptional<z.ZodEnum<{
            pin: "pin";
            preview: "preview";
          }>>;
        }, z.core.$strip>]>, z.ZodObject<{
          kind: z.ZodLiteral<"command">;
          target: z.ZodObject<{
            command: z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"command">;
              id: z.ZodString;
            }, z.core.$strip>;
            params: z.ZodOptional<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
          }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"href">;
          href: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
          kind: z.ZodLiteral<"compound">;
          targets: z.ZodArray<z.ZodUnion<readonly [z.ZodType<MetadataPageTarget, unknown, z.core.$ZodTypeInternals<MetadataPageTarget, unknown>>, z.ZodObject<{
            kind: z.ZodLiteral<"panel">;
            panel: z.ZodUnion<readonly [z.ZodObject<{
              extensionId: z.ZodString;
              kind: z.ZodLiteral<"placement">;
              id: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
              kind: z.ZodLiteral<"page-slot">;
              page: z.ZodObject<{
                extensionId: z.ZodString;
                kind: z.ZodLiteral<"page">;
                id: z.ZodString;
              }, z.core.$strip>;
              id: z.ZodString;
            }, z.core.$strip>]>;
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
            open: z.ZodOptional<z.ZodEnum<{
              pin: "pin";
              preview: "preview";
            }>>;
          }, z.core.$strip>]>>;
        }, z.core.$strip>]>;
        key: z.ZodString;
        canonicalChord: z.ZodString;
        parsed: z.ZodObject<{
          key: z.ZodString;
          ctrl: z.ZodBoolean;
          shift: z.ZodBoolean;
          alt: z.ZodBoolean;
          meta: z.ZodBoolean;
          modifiers: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        platformOverrides: z.ZodOptional<z.ZodObject<{
          mac: z.ZodOptional<z.ZodString>;
          linux: z.ZodOptional<z.ZodString>;
          win: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        when: z.ZodOptional<z.ZodObject<{
          mode: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          source: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            api: "api";
            automation: "automation";
            cli: "cli";
            "command-panel": "command-panel";
            dashboard: "dashboard";
            event: "event";
            schedule: "schedule";
          }>>>;
          viewId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
          resourceType: z.ZodOptional<z.ZodArray<z.ZodString>>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
      }, z.core.$strip>>>;
      settingsDefinitions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        extensionId: z.ZodString;
        type: z.ZodEnum<{
          array: "array";
          boolean: "boolean";
          number: "number";
          object: "object";
          string: "string";
        }>;
        scope: z.ZodEnum<{
          global: "global";
          project: "project";
        }>;
        default: z.ZodOptional<z.ZodUnknown>;
        enum: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        options: z.ZodOptional<z.ZodObject<{
          commandId: z.ZodString;
          valueField: z.ZodString;
          labelField: z.ZodString;
          params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
      }, z.core.$strip>>>;
      diagnostics: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        severity: z.ZodEnum<{
          error: "error";
          info: "info";
          warning: "warning";
        }>;
        message: z.ZodString;
        extensionId: z.ZodOptional<z.ZodString>;
        commandId: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
      }, z.core.$strip>>;
      extensionsRoot: z.ZodString;
      extensionsRootExists: z.ZodBoolean;
      errorCount: z.ZodNumber;
      warningCount: z.ZodNumber;
      middlewares: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        commandId: z.ZodString;
      }, z.core.$strip>>;
      hooks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        eventId: z.ZodString;
      }, z.core.$strip>>;
      schedules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        cron: z.ZodString;
        commandId: z.ZodString;
      }, z.core.$strip>>;
      artifactMounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        relativePath: z.ZodString;
        fullPath: z.ZodString;
        label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        watch: z.ZodBoolean;
      }, z.core.$strip>>;
      themes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        format: z.ZodLiteral<"vscode-color-theme">;
        mode: z.ZodEnum<{
          dark: "dark";
          light: "light";
        }>;
        source: z.ZodObject<{
          kind: z.ZodLiteral<"package-asset">;
          path: z.ZodString;
          baseUrl: z.ZodString;
        }, z.core.$strip>;
        tokens: z.ZodRecord<z.ZodString, z.ZodString>;
        monacoTheme: z.ZodObject<{
          base: z.ZodEnum<{
            vs: "vs";
            "vs-dark": "vs-dark";
          }>;
          inherit: z.ZodLiteral<true>;
          rules: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
          colors: z.ZodRecord<z.ZodString, z.ZodString>;
        }, z.core.$strip>;
      }, z.core.$strip>>;
      fileIconThemes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
        title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
          $l10n: z.ZodString;
          default: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
        format: z.ZodLiteral<"vscode-file-icon-theme">;
        source: z.ZodObject<{
          kind: z.ZodLiteral<"package-asset">;
          path: z.ZodString;
          baseUrl: z.ZodString;
        }, z.core.$strip>;
        definitions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        fileExtensions: z.ZodRecord<z.ZodString, z.ZodString>;
        fileNames: z.ZodRecord<z.ZodString, z.ZodString>;
        defaults: z.ZodDefault<z.ZodObject<{
          file: z.ZodOptional<z.ZodString>;
          folder: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        fonts: z.ZodDefault<z.ZodArray<z.ZodObject<{
          fontFamily: z.ZodString;
          src: z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            format: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>>;
          weight: z.ZodOptional<z.ZodString>;
          style: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
      }, z.core.$strip>>;
      templates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
      }, z.core.$strip>>;
      skills: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        extensionId: z.ZodString;
      }, z.core.$strip>>;
      hostCompatibility: z.ZodObject<{
        status: z.ZodEnum<{
          unverified: "unverified";
          verified: "verified";
        }>;
        host: z.ZodOptional<z.ZodObject<{
          host: z.ZodLiteral<"dashboard">;
          hostVersion: z.ZodString;
          capabilities: z.ZodRecord<z.ZodString, z.ZodObject<{
            version: z.ZodNumber;
            since: z.ZodOptional<z.ZodString>;
          }, z.core.$strip>>;
        }, z.core.$strip>>;
        diagnostics: z.ZodArray<z.ZodObject<{
          code: z.ZodString;
          severity: z.ZodEnum<{
            error: "error";
            info: "info";
            warning: "warning";
          }>;
          message: z.ZodString;
          extensionId: z.ZodOptional<z.ZodString>;
          commandId: z.ZodOptional<z.ZodString>;
          sourcePath: z.ZodOptional<z.ZodString>;
          metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
      }, z.core.$strip>;
    }, z.core.$strip>;
  }, z.core.$strip>>;
}, z.core.$strip>;
type InstallExtensionRequest = z.infer<typeof installExtensionRequestSchema>;
type InstallExtensionResponse = z.infer<typeof installExtensionResponseSchema>;
type ExtensionDiagnosticsResponse = z.infer<typeof extensionDiagnosticsResponseSchema>;
declare const extensionSettingValueRecordSchema: z.ZodObject<{
  key: z.ZodString;
  extensionId: z.ZodString;
  type: z.ZodEnum<{
    array: "array";
    boolean: "boolean";
    number: "number";
    object: "object";
    string: "string";
  }>;
  scope: z.ZodEnum<{
    global: "global";
    project: "project";
  }>;
  default: z.ZodOptional<z.ZodUnknown>;
  enum: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
  options: z.ZodOptional<z.ZodObject<{
    commandId: z.ZodString;
    valueField: z.ZodString;
    labelField: z.ZodString;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  }, z.core.$strip>>;
  title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    $l10n: z.ZodString;
    default: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>]>>;
  description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    $l10n: z.ZodString;
    default: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>]>>;
  value: z.ZodOptional<z.ZodUnknown>;
  source: z.ZodEnum<{
    default: "default";
    stored: "stored";
  }>;
}, z.core.$strip>;
type ExtensionSettingValueRecord = z.infer<typeof extensionSettingValueRecordSchema>;
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
declare const createProjectInputSchema: z.ZodObject<{
  name: z.ZodOptional<z.ZodString>;
  initial_workspace: z.ZodObject<{
    provider_id: z.ZodString;
    params: z.ZodDefault<z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>>;
  }, z.core.$strip>;
  agents: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
declare const updateProjectInputSchema: z.ZodObject<{
  name: z.ZodOptional<z.ZodString>;
  default_agent_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  default_agent_model: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
type Project = z.infer<typeof projectSchema>;
type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
interface RuntimeReadyResponse {
  ok: true;
  instanceId: string;
  ownerType: "desktop" | "persistent";
  protocolVersion: 1;
}
declare const settingsSchema: z.ZodObject<{
  notifications_enabled: z.ZodBoolean;
  machine_tokens_enabled: z.ZodBoolean;
  max_concurrent_sessions: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
declare const updateSettingsInputSchema: z.ZodObject<{
  notifications_enabled: z.ZodOptional<z.ZodBoolean>;
  machine_tokens_enabled: z.ZodOptional<z.ZodBoolean>;
  max_concurrent_sessions: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strict>;
type Settings = z.infer<typeof settingsSchema>;
type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;
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
declare const createWorkspaceInputSchema: z.ZodObject<{
  project_id: z.ZodString;
  provider_id: z.ZodString;
  params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  anchors: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
  }, z.core.$strip>>>;
  shorthand_base: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const renameWorkspaceInputSchema: z.ZodObject<{
  name: z.ZodString;
}, z.core.$strip>;
declare const removeWorktreeResponseSchema: z.ZodObject<{
  removed: z.ZodBoolean;
}, z.core.$strip>;
declare const workspaceFileEntrySchema: z.ZodObject<{
  path: z.ZodString;
  name: z.ZodString;
  type: z.ZodEnum<{
    directory: "directory";
    file: "file";
  }>;
  size: z.ZodOptional<z.ZodNumber>;
  modified_at: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const workspaceFilesResponseSchema: z.ZodObject<{
  workspace_id: z.ZodString;
  path: z.ZodString;
  entries: z.ZodArray<z.ZodObject<{
    path: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<{
      directory: "directory";
      file: "file";
    }>;
    size: z.ZodOptional<z.ZodNumber>;
    modified_at: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  truncated: z.ZodBoolean;
}, z.core.$strip>;
declare const workspaceFileContentSchema: z.ZodObject<{
  workspace_id: z.ZodString;
  path: z.ZodString;
  file_name: z.ZodString;
  mime_type: z.ZodOptional<z.ZodString>;
  size: z.ZodNumber;
  encoding: z.ZodEnum<{
    base64: "base64";
    utf8: "utf8";
  }>;
  content: z.ZodOptional<z.ZodString>;
  data_url: z.ZodOptional<z.ZodString>;
  editable: z.ZodBoolean;
}, z.core.$strip>;
declare const writeWorkspaceFileInputSchema: z.ZodObject<{
  content: z.ZodString;
}, z.core.$strip>;
declare const listWorkspaceFilesInputSchema: z.ZodObject<{
  path: z.ZodOptional<z.ZodString>;
  query: z.ZodOptional<z.ZodString>;
  limit: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
declare const listWorkspaceActivityInputSchema: z.ZodObject<{
  event_type: z.ZodOptional<z.ZodString>;
  from: z.ZodOptional<z.ZodString>;
  to: z.ZodOptional<z.ZodString>;
  cursor: z.ZodOptional<z.ZodString>;
  limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
declare const listWorkspaceActivityResponseSchema: z.ZodObject<{
  events: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    project_id: z.ZodString;
    resource_type: z.ZodString;
    resource_id: z.ZodString;
    source_extension_id: z.ZodNullable<z.ZodString>;
    event_type: z.ZodString;
    actor_type: z.ZodEnum<{
      agent: "agent";
      system: "system";
      user: "user";
    }>;
    actor_id: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<{
      agent: "agent";
      api: "api";
      hook: "hook";
      system: "system";
      ui: "ui";
    }>;
    summary: z.ZodString;
    payload_json: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    created_at: z.ZodString;
  }, z.core.$strip>>;
  next_cursor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
type Workspace = z.infer<typeof workspaceSchema>;
type WorkspaceListItem = z.infer<typeof workspaceListItemSchema>;
type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
type RenameWorkspaceInput = z.infer<typeof renameWorkspaceInputSchema>;
type RemoveWorktreeResponse = z.infer<typeof removeWorktreeResponseSchema>;
type WorkspaceFileEntry = z.infer<typeof workspaceFileEntrySchema>;
type WorkspaceFilesResponse = z.infer<typeof workspaceFilesResponseSchema>;
type WorkspaceFileContent = z.infer<typeof workspaceFileContentSchema>;
type WriteWorkspaceFileInput = z.infer<typeof writeWorkspaceFileInputSchema>;
type ListWorkspaceFilesInput = z.infer<typeof listWorkspaceFilesInputSchema>;
type ListWorkspaceActivityInput = z.infer<typeof listWorkspaceActivityInputSchema>;
type ListWorkspaceActivityResponse = z.infer<typeof listWorkspaceActivityResponseSchema>;
declare const workspaceProviderDescriptorSchema: z.ZodObject<{
  id: z.ZodString;
  label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    $l10n: z.ZodString;
    default: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>]>;
  icon: z.ZodOptional<z.ZodString>;
  description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    $l10n: z.ZodString;
    default: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>]>>;
  params: z.ZodRecord<z.ZodString, z.ZodObject<{
    type: z.ZodString;
  }, z.core.$catchall<z.ZodUnknown>>>;
}, z.core.$strip>;
type WorkspaceProviderDescriptor = z.infer<typeof workspaceProviderDescriptorSchema>;
type ClientOptions = {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
};
export declare class PstdioApiError extends Error {
  readonly code?: string | undefined;
  status: number;
  constructor(message: string, status: number, code?: string | undefined);
}
export declare class PstdioConnectionError extends Error {
  constructor(cause: unknown);
}
type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  headers?: HeadersInit;
  cache?: RequestCache;
  response?: "stream";
};
type RequestFn = <T>(path: string, options?: RequestOptions) => Promise<T>;
export declare const createRequest: (options: ClientOptions) => RequestFn;
type AgentClient = {
  getParamDefaults(projectId: string, agentId: string, model?: string): Promise<{
    schema: HarnessParamsInfo | null;
    defaults: HarnessParams;
  }>;
  setParamDefaults(projectId: string, agentId: string, params: HarnessParams): Promise<{
    schema: HarnessParamsInfo | null;
    defaults: HarnessParams;
  }>;
  info(params?: {
    project?: string;
  }): Promise<AgentInfo[]>;
  models(agentId: string, projectId?: string): Promise<AgentModel[]>;
};
interface AssetClientOwner {
  projectId: string;
  extensionInstanceId: string;
}
interface AssetUploadInput extends AssetClientOwner {
  operationId: string;
  source: Blob;
  signal?: AbortSignal;
  onProgress?: (uploadedByteLength: number) => void;
}
interface AssetOperationInput extends AssetClientOwner {
  operationId: string;
  signal?: AbortSignal;
}
interface AssetReadInput extends AssetClientOwner {
  asset: AssetReference$1;
  signal?: AbortSignal;
}
declare const createAssetsClient: (request: RequestFn) => {
  begin: (input: AssetOperationInput & {
    expected: AssetReference$1;
  }) => Promise<{
    status: "staging";
    operationId: string;
    expected: {
      sha256: string;
      byteLength: number;
      mediaType: string;
    };
    uploadedByteLength: number;
  } | {
    status: "complete";
    operationId: string;
    asset: {
      sha256: string;
      byteLength: number;
      mediaType: string;
    };
  } | {
    status: "cancelled";
    operationId: string;
    expected: {
      sha256: string;
      byteLength: number;
      mediaType: string;
    };
  }>;
  get: (input: AssetOperationInput) => Promise<{
    status: "staging";
    operationId: string;
    expected: {
      sha256: string;
      byteLength: number;
      mediaType: string;
    };
    uploadedByteLength: number;
  } | {
    status: "complete";
    operationId: string;
    asset: {
      sha256: string;
      byteLength: number;
      mediaType: string;
    };
  } | {
    status: "cancelled";
    operationId: string;
    expected: {
      sha256: string;
      byteLength: number;
      mediaType: string;
    };
  }>;
  cancel: (input: AssetOperationInput) => Promise<{
    status: "staging";
    operationId: string;
    expected: {
      sha256: string;
      byteLength: number;
      mediaType: string;
    };
    uploadedByteLength: number;
  } | {
    status: "complete";
    operationId: string;
    asset: {
      sha256: string;
      byteLength: number;
      mediaType: string;
    };
  } | {
    status: "cancelled";
    operationId: string;
    expected: {
      sha256: string;
      byteLength: number;
      mediaType: string;
    };
  }>;
  upload: (input: AssetUploadInput) => Promise<{
    sha256: string;
    byteLength: number;
    mediaType: string;
  }>;
  read: (input: AssetReadInput) => Promise<ReadableStream<Uint8Array<ArrayBufferLike>>>;
};
type AssetsClient = ReturnType<typeof createAssetsClient>;
type AutomationClient = {
  issueToken(input: IssueAutomationTokenInput): Promise<IssueAutomationTokenResponse>;
  listTokens(projectId: string): Promise<ListAutomationTokensResponse>;
  revokeToken(tokenId: string): Promise<void>;
  createRun(projectId: string, idempotencyKey: string, input: CreateAutomationRunInput): Promise<AutomationRun>;
  getRun(projectId: string, runId: string): Promise<AutomationRun>;
  listRunEvents(projectId: string, runId: string, after?: number): Promise<ListAutomationRunEventsResponse>;
  cancelRun(projectId: string, runId: string): Promise<AutomationRun>;
};
declare const createBoardViewsClient: (request: RequestFn) => {
  board: (projectId: string, boardId: string) => Promise<{
    id: string;
    title: string;
    kind: "dataTable" | "kanban";
    extensionId: string | null;
    fields: {
      id: string;
      label: string;
      kind: "boolean" | "date" | "enum" | "enum-multi" | "number" | "status" | "string" | "user";
      conditions: ("contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte")[];
      filterable: boolean;
      groupable: boolean;
      sortable: boolean;
      displayable: boolean;
      legacyValues?: Record<string, boolean> | undefined;
      options?: {
        value: string;
        label: string;
      }[] | undefined;
    }[];
  }>;
  get: (projectId: string, id: string) => Promise<{
    id: string;
    boardId: string;
    title: string;
    settings: {
      viewMode: "board" | "list";
      columnGrouping: string;
      rowGrouping: string;
      displayProperties: string[];
    } | {
      grouping: string;
      rowNumbers: boolean;
      wrapRows: boolean;
      showStats: boolean;
      hiddenColumns: string[];
      columnOrder: string[];
    };
    filter: {
      conjunction: "and" | "or";
      rules: {
        attributeId: string;
        condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
        value?: string | number | boolean | string[] | undefined;
      }[];
      groups?: {
        conjunction: "and" | "or";
        rules: {
          attributeId: string;
          condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
          value?: string | number | boolean | string[] | undefined;
        }[];
      }[] | undefined;
    };
    sorts: {
      attributeId: string;
      direction: "asc" | "desc";
    }[];
    builtIn: boolean;
  }>;
  boards: (projectId: string) => Promise<{
    id: string;
    title: string;
    kind: "dataTable" | "kanban";
    extensionId: string | null;
    fields: {
      id: string;
      label: string;
      kind: "boolean" | "date" | "enum" | "enum-multi" | "number" | "status" | "string" | "user";
      conditions: ("contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte")[];
      filterable: boolean;
      groupable: boolean;
      sortable: boolean;
      displayable: boolean;
      legacyValues?: Record<string, boolean> | undefined;
      options?: {
        value: string;
        label: string;
      }[] | undefined;
    }[];
  }[]>;
  list: (projectId: string, boardId: string, options?: {
    signal?: AbortSignal;
  }) => Promise<{
    views: {
      id: string;
      boardId: string;
      title: string;
      settings: {
        viewMode: "board" | "list";
        columnGrouping: string;
        rowGrouping: string;
        displayProperties: string[];
      } | {
        grouping: string;
        rowNumbers: boolean;
        wrapRows: boolean;
        showStats: boolean;
        hiddenColumns: string[];
        columnOrder: string[];
      };
      filter: {
        conjunction: "and" | "or";
        rules: {
          attributeId: string;
          condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
          value?: string | number | boolean | string[] | undefined;
        }[];
        groups?: {
          conjunction: "and" | "or";
          rules: {
            attributeId: string;
            condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
            value?: string | number | boolean | string[] | undefined;
          }[];
        }[] | undefined;
      };
      sorts: {
        attributeId: string;
        direction: "asc" | "desc";
      }[];
      builtIn: boolean;
    }[];
    defaultViewId: string;
  }>;
  orphaned: (projectId: string) => Promise<{
    id: string;
    boardId: string;
    title: string;
    settings: {
      viewMode: "board" | "list";
      columnGrouping: string;
      rowGrouping: string;
      displayProperties: string[];
    } | {
      grouping: string;
      rowNumbers: boolean;
      wrapRows: boolean;
      showStats: boolean;
      hiddenColumns: string[];
      columnOrder: string[];
    };
    filter: {
      conjunction: "and" | "or";
      rules: {
        attributeId: string;
        condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
        value?: string | number | boolean | string[] | undefined;
      }[];
      groups?: {
        conjunction: "and" | "or";
        rules: {
          attributeId: string;
          condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
          value?: string | number | boolean | string[] | undefined;
        }[];
      }[] | undefined;
    };
    sorts: {
      attributeId: string;
      direction: "asc" | "desc";
    }[];
    builtIn: boolean;
  }[]>;
  create: (projectId: string, boardId: string, input: BoardViewCreate) => Promise<{
    id: string;
    boardId: string;
    title: string;
    settings: {
      viewMode: "board" | "list";
      columnGrouping: string;
      rowGrouping: string;
      displayProperties: string[];
    } | {
      grouping: string;
      rowNumbers: boolean;
      wrapRows: boolean;
      showStats: boolean;
      hiddenColumns: string[];
      columnOrder: string[];
    };
    filter: {
      conjunction: "and" | "or";
      rules: {
        attributeId: string;
        condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
        value?: string | number | boolean | string[] | undefined;
      }[];
      groups?: {
        conjunction: "and" | "or";
        rules: {
          attributeId: string;
          condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
          value?: string | number | boolean | string[] | undefined;
        }[];
      }[] | undefined;
    };
    sorts: {
      attributeId: string;
      direction: "asc" | "desc";
    }[];
    builtIn: boolean;
  }>;
  update: (projectId: string, id: string, input: BoardViewUpdate) => Promise<{
    id: string;
    boardId: string;
    title: string;
    settings: {
      viewMode: "board" | "list";
      columnGrouping: string;
      rowGrouping: string;
      displayProperties: string[];
    } | {
      grouping: string;
      rowNumbers: boolean;
      wrapRows: boolean;
      showStats: boolean;
      hiddenColumns: string[];
      columnOrder: string[];
    };
    filter: {
      conjunction: "and" | "or";
      rules: {
        attributeId: string;
        condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
        value?: string | number | boolean | string[] | undefined;
      }[];
      groups?: {
        conjunction: "and" | "or";
        rules: {
          attributeId: string;
          condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
          value?: string | number | boolean | string[] | undefined;
        }[];
      }[] | undefined;
    };
    sorts: {
      attributeId: string;
      direction: "asc" | "desc";
    }[];
    builtIn: boolean;
  }>;
  delete: (projectId: string, id: string) => Promise<{
    deleted: boolean;
  }>;
  reorder: (projectId: string, boardId: string, viewIds: string[]) => Promise<{
    views: {
      id: string;
      boardId: string;
      title: string;
      settings: {
        viewMode: "board" | "list";
        columnGrouping: string;
        rowGrouping: string;
        displayProperties: string[];
      } | {
        grouping: string;
        rowNumbers: boolean;
        wrapRows: boolean;
        showStats: boolean;
        hiddenColumns: string[];
        columnOrder: string[];
      };
      filter: {
        conjunction: "and" | "or";
        rules: {
          attributeId: string;
          condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
          value?: string | number | boolean | string[] | undefined;
        }[];
        groups?: {
          conjunction: "and" | "or";
          rules: {
            attributeId: string;
            condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
            value?: string | number | boolean | string[] | undefined;
          }[];
        }[] | undefined;
      };
      sorts: {
        attributeId: string;
        direction: "asc" | "desc";
      }[];
      builtIn: boolean;
    }[];
    defaultViewId: string;
  }>;
  setDefault: (projectId: string, boardId: string, viewId: string | null) => Promise<{
    views: {
      id: string;
      boardId: string;
      title: string;
      settings: {
        viewMode: "board" | "list";
        columnGrouping: string;
        rowGrouping: string;
        displayProperties: string[];
      } | {
        grouping: string;
        rowNumbers: boolean;
        wrapRows: boolean;
        showStats: boolean;
        hiddenColumns: string[];
        columnOrder: string[];
      };
      filter: {
        conjunction: "and" | "or";
        rules: {
          attributeId: string;
          condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
          value?: string | number | boolean | string[] | undefined;
        }[];
        groups?: {
          conjunction: "and" | "or";
          rules: {
            attributeId: string;
            condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
            value?: string | number | boolean | string[] | undefined;
          }[];
        }[] | undefined;
      };
      sorts: {
        attributeId: string;
        direction: "asc" | "desc";
      }[];
      builtIn: boolean;
    }[];
    defaultViewId: string;
  }>;
};
type BoardViewsClient = ReturnType<typeof createBoardViewsClient>;
declare const createExtensionControlsClient: (request: RequestFn) => {
  projectSettings: {
    all: (projectId: string, instanceId: string) => Promise<{
      settings: ExtensionSettingValueRecord[];
    }>;
    get: (projectId: string, instanceId: string, key: string) => Promise<{
      key: string;
      extensionId: string;
      type: "array" | "boolean" | "number" | "object" | "string";
      scope: "global" | "project";
      default?: unknown;
      enum?: unknown[] | undefined;
      options?: {
        commandId: string;
        valueField: string;
        labelField: string;
        params?: Record<string, unknown> | undefined;
      } | undefined;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      value?: unknown;
      source: "default" | "stored";
    }>;
    set: (projectId: string, instanceId: string, key: string, value: unknown) => Promise<{
      key: string;
      extensionId: string;
      type: "array" | "boolean" | "number" | "object" | "string";
      scope: "global" | "project";
      default?: unknown;
      enum?: unknown[] | undefined;
      options?: {
        commandId: string;
        valueField: string;
        labelField: string;
        params?: Record<string, unknown> | undefined;
      } | undefined;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      value?: unknown;
      source: "default" | "stored";
    }>;
    delete: (projectId: string, instanceId: string, key: string) => Promise<void>;
  };
  installedSettings: {
    all: (installName: string) => Promise<{
      settings: ExtensionSettingValueRecord[];
    }>;
    get: (installName: string, key: string) => Promise<{
      key: string;
      extensionId: string;
      type: "array" | "boolean" | "number" | "object" | "string";
      scope: "global" | "project";
      default?: unknown;
      enum?: unknown[] | undefined;
      options?: {
        commandId: string;
        valueField: string;
        labelField: string;
        params?: Record<string, unknown> | undefined;
      } | undefined;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      value?: unknown;
      source: "default" | "stored";
    }>;
    set: (installName: string, key: string, value: unknown) => Promise<{
      key: string;
      extensionId: string;
      type: "array" | "boolean" | "number" | "object" | "string";
      scope: "global" | "project";
      default?: unknown;
      enum?: unknown[] | undefined;
      options?: {
        commandId: string;
        valueField: string;
        labelField: string;
        params?: Record<string, unknown> | undefined;
      } | undefined;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      value?: unknown;
      source: "default" | "stored";
    }>;
    delete: (installName: string, key: string) => Promise<void>;
  };
  projectPreferences: {
    get: (projectId: string, instanceId: string, name: string, scope?: WebviewPreferencesGetParams["scope"]) => Promise<{
      value?: WebviewPreferencesSetParams["value"];
    }>;
    set: (projectId: string, instanceId: string, name: string, value: WebviewPreferencesSetParams["value"], scope?: WebviewPreferencesGetParams["scope"]) => Promise<{
      name: string;
      value: WebviewPreferencesSetParams["value"];
    }>;
  };
  installedPreferences: {
    get: (installName: string, name: string, scope?: WebviewPreferencesGetParams["scope"]) => Promise<{
      value?: WebviewPreferencesSetParams["value"];
    }>;
    set: (installName: string, name: string, value: WebviewPreferencesSetParams["value"], scope?: WebviewPreferencesGetParams["scope"]) => Promise<{
      name: string;
      value: WebviewPreferencesSetParams["value"];
    }>;
  };
  files: {
    upload: (projectId: string, instanceId: string, input: WebviewFilesUploadParams) => Promise<ExtensionBlobRef>;
    list: (projectId: string, instanceId: string, input?: WebviewFilesListParams) => Promise<{
      files: ExtensionBlobRef[];
    }>;
    delete: (projectId: string, instanceId: string, id: string) => Promise<void>;
  };
};
declare const createExtensionManagementClient: (request: RequestFn) => {
  createNotification: (projectId: string, extensionId: string, body: Omit<CreateNotificationInput, "projectId">) => Promise<Notification>;
  metadata: (projectId: string) => Promise<{
    extensions: {
      id: string;
      name: string;
      displayName: string;
      extensionInstanceId?: string | undefined;
      installedExtensionId?: string | undefined;
      installName?: string | undefined;
      version?: string | undefined;
      description?: string | undefined;
      sourcePath: string;
    }[];
    commands: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      cliPath?: string | undefined;
      cliAliases?: string[] | undefined;
      examples?: string[] | undefined;
      automation?: boolean | undefined;
      mutating?: boolean | undefined;
      resourceMutation?: {
        kind: "rename";
        resourceType: string;
        idParam: string;
        labelParam: string;
      } | {
        kind: "remove";
        resourceType: string;
        idParam: string;
      } | undefined;
      params?: Record<string, {
        [x: string]: unknown;
        type: string;
      }> | undefined;
    }[];
    menuContributions: {
      id: string;
      extensionId: string;
      commandId: string;
      slotId: string;
      target?: "workbench.nav.actions" | "workbench.nav.overflow" | undefined;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      group?: string | undefined;
      placement?: "default" | "first" | "last" | undefined;
      icon?: string | undefined;
      presentation?: "button" | "icon-button" | "menu-item" | undefined;
      params?: Record<string, unknown> | undefined;
      when?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
      disabledWhen?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
      disabledReason?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[];
    commandPaletteContributions?: {
      id: string;
      extensionId: string;
      commandId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      group?: string | undefined;
      placement?: "default" | "first" | "last" | undefined;
      icon?: string | undefined;
      params?: Record<string, unknown> | undefined;
      when?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
    }[] | undefined;
    modes: {
      id: string;
      localId: string;
      extensionId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      regions: ("main" | "secondary" | "side")[];
      floatingPanels?: "hidden" | "visible" | undefined;
      regionSettings?: Partial<Record<"main" | "secondary" | "side" | "sidenav", {
        showHeader?: boolean | undefined;
        size?: {
          defaultPx?: number | undefined;
          minPx?: number | undefined;
          maxPx?: number | undefined;
        } | undefined;
        collapsible?: boolean | undefined;
        alwaysShowTabs?: boolean | undefined;
      }>> | undefined;
      defaultTheme?: {
        extensionId: string;
        kind: "theme";
        id: string;
      } | undefined;
      chrome?: Partial<Record<"activity" | "nav" | "sidenav" | "status", false | {
        extensionId: string;
        kind: "view";
        id: string;
      }>> | undefined;
    }[];
    pages: {
      id: string;
      localId: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      path: string;
      params?: Record<string, {
        type: "string";
        default?: string | undefined;
        values?: readonly string[] | undefined;
      } | {
        type: "number";
        default?: number | undefined;
      } | {
        type: "boolean";
        default?: boolean | undefined;
      } | {
        type: "string[]";
        default?: readonly string[] | undefined;
      }> | undefined;
      document?: {
        metadataKey: string;
      } | undefined;
      mode: {
        extensionId: string;
        kind: "mode";
        id: string;
      };
      parent?: {
        extensionId: string;
        kind: "page";
        id: string;
      } | undefined;
      resource?: {
        kinds: {
          extensionId: string;
          kind: "resource-kind";
          id: string;
        }[];
      } | undefined;
      main: {
        kind: "panels";
        empty: {
          extensionId: string;
          kind: "view";
          id: string;
        };
      } | {
        mountStrategy?: "active" | "keep-mounted" | undefined;
        hiddenByDefault?: boolean | undefined;
        headerBorderBottom?: boolean | undefined;
        tab?: {
          queryHandlerId: string;
          refreshEventIds?: string[] | undefined;
        } | undefined;
        kind: "view";
        view: {
          extensionId: string;
          kind: "view";
          id: string;
        };
        cardinality: "many" | "one";
      };
      slots: {
        mountStrategy?: "active" | "keep-mounted" | undefined;
        hiddenByDefault?: boolean | undefined;
        headerBorderBottom?: boolean | undefined;
        tab?: {
          queryHandlerId: string;
          refreshEventIds?: string[] | undefined;
        } | undefined;
        id: string;
        region: "main" | "secondary" | "side";
        order?: number | undefined;
        item: {
          kind: "view";
          view: {
            extensionId: string;
            kind: "view";
            id: string;
          };
          presence: "closed" | "fixed" | "open";
        } | {
          kind: "binding";
          binding: {
            kinds: {
              extensionId: string;
              kind: "resource-kind";
              id: string;
            }[];
            view: {
              extensionId: string;
              kind: "view";
              id: string;
            };
            cardinality: "many" | "one";
            add?: MetadataPageTarget | {
              kind: "command";
              target: {
                command: {
                  extensionId: string;
                  kind: "command";
                  id: string;
                };
                params?: JsonObject | undefined;
              };
            } | {
              kind: "href";
              href: string;
            } | {
              kind: "compound";
              targets: (MetadataPageTarget | {
                kind: "panel";
                panel: {
                  extensionId: string;
                  kind: "placement";
                  id: string;
                } | {
                  kind: "page-slot";
                  page: {
                    extensionId: string;
                    kind: "page";
                    id: string;
                  };
                  id: string;
                };
                resource?: {
                  shorthand?: string | undefined;
                  type: string;
                  id: string;
                  projectId?: string | undefined;
                  label?: string | undefined;
                  icon?: string | undefined;
                  extensionId?: string | undefined;
                  metadata?: JsonObject | undefined;
                } | undefined;
                open?: "pin" | "preview" | undefined;
              })[];
            } | {
              kind: "panel";
              panel: {
                extensionId: string;
                kind: "placement";
                id: string;
              } | {
                kind: "page-slot";
                page: {
                  extensionId: string;
                  kind: "page";
                  id: string;
                };
                id: string;
              };
              resource?: {
                shorthand?: string | undefined;
                type: string;
                id: string;
                projectId?: string | undefined;
                label?: string | undefined;
                icon?: string | undefined;
                extensionId?: string | undefined;
                metadata?: JsonObject | undefined;
              } | undefined;
              open?: "pin" | "preview" | undefined;
            } | undefined;
          };
        };
        openOn?: "page-resource" | undefined;
      }[];
    }[];
    views: {
      id: string;
      localId: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      body: {
        kind: "webview";
        webview: {
          entry: {
            kind: "package-asset";
            path: string;
            baseUrl: string;
          };
          title?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          capabilities?: string[] | undefined;
          runtimeUrl: string;
          moduleUrl: string;
          styles?: string[] | undefined;
        };
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        searchable?: boolean | undefined;
        searchPlaceholder?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        headerHandlerId?: string | undefined;
        bodyHandlerId: string;
        childrenHandlerId?: string | undefined;
        moveHandlerId?: string | undefined;
        footerHandlerId?: string | undefined;
        defaultExpandedSectionIds?: string[] | undefined;
        defaultExpandedNodeIds?: string[] | undefined;
        kind: "tree";
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        loadHandlerId: string;
        saveHandlerId?: string | undefined;
        kind: "file";
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        queryHandlerId: string;
        valueChangeHandlerId?: string | undefined;
        applyHandlerId?: string | undefined;
        resetHandlerId?: string | undefined;
        defaultValues?: Record<string, string | number | boolean | string[] | {
          x: number;
          y: number;
        } | {
          harnessId: string;
          model?: string | undefined;
          params?: Record<string, string | boolean> | undefined;
        } | [number, number] | null> | undefined;
        kind: "controls";
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        extensionInstanceId?: string | undefined;
        attributes?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          type: {
            kind: "enum";
            options: {
              value: string;
              label: string | {
                $l10n: string;
                default?: string | undefined;
              };
              color?: string | undefined;
              icon?: string | null | undefined;
            }[];
          } | {
            kind: "enum-multi";
            options: {
              value: string;
              label: string | {
                $l10n: string;
                default?: string | undefined;
              };
              color?: string | undefined;
              icon?: string | null | undefined;
            }[];
          } | {
            kind: "boolean";
            legacyValues?: Record<string, boolean> | undefined;
          } | {
            kind: "string";
          } | {
            kind: "date";
          } | {
            kind: "number";
          } | {
            kind: "user";
          };
          filterable?: boolean | undefined;
          groupable?: boolean | undefined;
          sortable?: boolean | undefined;
          displayable?: boolean | undefined;
          editable?: boolean | undefined;
          display?: {
            [x: string]: unknown;
            kind: string;
          } | {
            kind: "badge-list";
            itemsAttributeId: string;
          } | undefined;
        }[] | undefined;
        queryHandlerId: string;
        attributeChangeHandlerId?: string | undefined;
        moveHandlerId?: string | undefined;
        schemaRefreshEventIds?: string[] | undefined;
        columnActionHandlerId?: string | undefined;
        rowActivationHandlerId?: string | undefined;
        defaultSettings?: {
          viewMode?: "board" | "list" | undefined;
          columnGrouping?: string | undefined;
          rowGrouping?: string | undefined;
          displayProperties?: string[] | undefined;
        } | undefined;
        defaultFilter?: {
          conjunction: "and" | "or";
          rules: {
            attributeId: string;
            condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
            value?: string | number | boolean | string[] | undefined;
          }[];
          groups?: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
          }[] | undefined;
        } | undefined;
        defaultSorts?: {
          attributeId: string;
          direction: "asc" | "desc";
        }[] | undefined;
        defaultViews?: {
          id: string;
          title: string | {
            $l10n: string;
            default?: string | undefined;
          };
          settings: {
            viewMode: "board" | "list";
            columnGrouping: string;
            rowGrouping: string;
            displayProperties: string[];
          };
          filter: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
            groups?: {
              conjunction: "and" | "or";
              rules: {
                attributeId: string;
                condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
                value?: string | number | boolean | string[] | undefined;
              }[];
            }[] | undefined;
          };
          sorts: {
            attributeId: string;
            direction: "asc" | "desc";
          }[];
        }[] | undefined;
        defaultActiveViewId?: string | undefined;
        hideToolbar?: boolean | undefined;
        kind: "kanban";
        createRow?: {
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
          title?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          submitLabel?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          columnParam?: string | undefined;
          params?: Record<string, unknown> | undefined;
          attributesParam?: string | undefined;
          attachments?: {
            command: {
              extensionId: string;
              kind: "command";
              id: string;
            };
            resourceParam: string;
            fileParam: string;
          } | undefined;
          labels?: {
            cancel?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
            properties?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
            submitError?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
            removeFile?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
          } | undefined;
        } | undefined;
        rowActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          destructive?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
        toolbarActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          presentation?: "primary" | "secondary" | undefined;
          params?: Record<string, unknown> | undefined;
          input?: Record<string, {
            [x: string]: unknown;
            type: string;
          }> | undefined;
          submitLabel?: string | undefined;
          when?: string | undefined;
          disabled?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        columns?: {
          id: string;
          label?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          type?: "boolean" | "date" | "number" | "string" | undefined;
          groupable?: boolean | undefined;
          filterable?: boolean | undefined;
          description?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          icon?: string | undefined;
          hidden?: boolean | undefined;
          stat?: {
            type: "unique";
          } | {
            type: "histogram";
            bins?: number | undefined;
          } | {
            type: "top-values";
            limit?: number | undefined;
          } | undefined;
          renderer?: {
            type: "json";
          } | {
            type: "color-scale";
            stops: {
              value: number;
              color: {
                light: string;
                dark: string;
                foreground?: {
                  light: string;
                  dark: string;
                } | undefined;
              };
            }[];
          } | {
            type: "categorical-color";
            categories: {
              value: string | number | boolean | null;
              color: {
                light: string;
                dark: string;
                foreground?: {
                  light: string;
                  dark: string;
                } | undefined;
              };
            }[];
          } | undefined;
        }[] | undefined;
        queryHandlerId: string;
        selectionMode?: "multiple" | "none" | undefined;
        rowActivationHandlerId?: string | undefined;
        initialPageSize?: number | undefined;
        pageSizeOptions?: number[] | undefined;
        defaultSettings?: {
          grouping?: string | undefined;
          rowNumbers?: boolean | undefined;
          wrapRows?: boolean | undefined;
          showStats?: boolean | undefined;
          hiddenColumns?: string[] | undefined;
          columnOrder?: string[] | undefined;
        } | undefined;
        defaultFilter?: {
          conjunction: "and" | "or";
          rules: {
            attributeId: string;
            condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
            value?: string | number | boolean | string[] | undefined;
          }[];
          groups?: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
          }[] | undefined;
        } | undefined;
        defaultSorts?: {
          attributeId: string;
          direction: "asc" | "desc";
        }[] | undefined;
        defaultViews?: {
          id: string;
          title: string | {
            $l10n: string;
            default?: string | undefined;
          };
          settings?: {
            grouping?: string | undefined;
            rowNumbers?: boolean | undefined;
            wrapRows?: boolean | undefined;
            showStats?: boolean | undefined;
            hiddenColumns?: string[] | undefined;
            columnOrder?: string[] | undefined;
          } | undefined;
          filter?: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
            groups?: {
              conjunction: "and" | "or";
              rules: {
                attributeId: string;
                condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
                value?: string | number | boolean | string[] | undefined;
              }[];
            }[] | undefined;
          } | undefined;
          sorts?: {
            attributeId: string;
            direction: "asc" | "desc";
          }[] | undefined;
        }[] | undefined;
        defaultActiveViewId?: string | undefined;
        kind: "dataTable";
        selectionActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          destructive?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
        rowActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          destructive?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
        toolbarActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          presentation?: "primary" | "secondary" | undefined;
          params?: Record<string, unknown> | undefined;
          input?: Record<string, {
            [x: string]: unknown;
            type: string;
          }> | undefined;
          submitLabel?: string | undefined;
          when?: string | undefined;
          disabled?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
      };
    }[];
    viewMenus: {
      id: string;
      extensionId: string;
      owner: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      side: "left" | "right";
      group?: string | undefined;
      placement?: "default" | "first" | "last" | undefined;
      hostTreeHeader?: "default" | "none" | undefined;
      hostTreeFooter?: "default" | "none" | undefined;
    }[];
    placements: {
      mountStrategy?: "active" | "keep-mounted" | undefined;
      hiddenByDefault?: boolean | undefined;
      headerBorderBottom?: boolean | undefined;
      tab?: {
        queryHandlerId: string;
        refreshEventIds?: string[] | undefined;
      } | undefined;
      id: string;
      localId: string;
      extensionId: string;
      mode: {
        extensionId: string;
        kind: "mode";
        id: string;
      };
      item: {
        kind: "view";
        view: {
          extensionId: string;
          kind: "view";
          id: string;
        };
        presence: "closed" | "fixed" | "open";
      } | {
        kind: "binding";
        binding: {
          kinds: {
            extensionId: string;
            kind: "resource-kind";
            id: string;
          }[];
          view: {
            extensionId: string;
            kind: "view";
            id: string;
          };
          cardinality: "many" | "one";
          add?: MetadataPageTarget | {
            kind: "command";
            target: {
              command: {
                extensionId: string;
                kind: "command";
                id: string;
              };
              params?: JsonObject | undefined;
            };
          } | {
            kind: "href";
            href: string;
          } | {
            kind: "compound";
            targets: (MetadataPageTarget | {
              kind: "panel";
              panel: {
                extensionId: string;
                kind: "placement";
                id: string;
              } | {
                kind: "page-slot";
                page: {
                  extensionId: string;
                  kind: "page";
                  id: string;
                };
                id: string;
              };
              resource?: {
                shorthand?: string | undefined;
                type: string;
                id: string;
                projectId?: string | undefined;
                label?: string | undefined;
                icon?: string | undefined;
                extensionId?: string | undefined;
                metadata?: JsonObject | undefined;
              } | undefined;
              open?: "pin" | "preview" | undefined;
            })[];
          } | {
            kind: "panel";
            panel: {
              extensionId: string;
              kind: "placement";
              id: string;
            } | {
              kind: "page-slot";
              page: {
                extensionId: string;
                kind: "page";
                id: string;
              };
              id: string;
            };
            resource?: {
              shorthand?: string | undefined;
              type: string;
              id: string;
              projectId?: string | undefined;
              label?: string | undefined;
              icon?: string | undefined;
              extensionId?: string | undefined;
              metadata?: JsonObject | undefined;
            } | undefined;
            open?: "pin" | "preview" | undefined;
          } | undefined;
        };
      };
      region: "main" | "secondary" | "side";
      order?: number | undefined;
      movableTo?: ("main" | "secondary" | "side")[] | undefined;
    }[];
    resourceKinds: {
      id: string;
      localId: string;
      extensionId: string;
      label?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      icon?: string | undefined;
      resolveCommand?: string | undefined;
      resolveManyCommand?: string | undefined;
      paths?: {
        prefix: string;
        resolveCommand: string;
      }[] | undefined;
      menuSlots?: {
        id: string;
        placement: "context-menu" | "header-overflow" | "header-primary";
        label?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        access: "owner" | "public";
        order?: number | undefined;
      }[] | undefined;
    }[];
    resourceHierarchyProviders?: {
      id: string;
      extensionId: string;
      resourceKind: {
        extensionId: string;
        kind: "resource-kind";
        id: string;
      };
    }[] | undefined;
    navigationItems: {
      id: string;
      extensionId: string;
      owner: {
        extensionId: string;
        kind: "mode";
        id: string;
      } | {
        extensionId: string;
        kind: "page";
        id: string;
      };
      slot: "content" | "footer" | "header";
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      group?: string | undefined;
      when?: {
        mode?: {
          extensionId: string;
          kind: "mode";
          id: string;
        }[] | {
          extensionId: string;
          kind: "mode";
          id: string;
        } | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        view?: {
          extensionId: string;
          kind: "view";
          id: string;
        }[] | {
          extensionId: string;
          kind: "view";
          id: string;
        } | undefined;
        resourceType?: {
          extensionId: string;
          kind: "resource-kind";
          id: string;
        }[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
      action: MetadataPageTarget | {
        kind: "command";
        target: {
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
          params?: JsonObject | undefined;
        };
      } | {
        kind: "href";
        href: string;
      } | {
        kind: "compound";
        targets: (MetadataPageTarget | {
          kind: "panel";
          panel: {
            extensionId: string;
            kind: "placement";
            id: string;
          } | {
            kind: "page-slot";
            page: {
              extensionId: string;
              kind: "page";
              id: string;
            };
            id: string;
          };
          resource?: {
            shorthand?: string | undefined;
            type: string;
            id: string;
            projectId?: string | undefined;
            label?: string | undefined;
            icon?: string | undefined;
            extensionId?: string | undefined;
            metadata?: JsonObject | undefined;
          } | undefined;
          open?: "pin" | "preview" | undefined;
        })[];
      } | {
        kind: "panel";
        panel: {
          extensionId: string;
          kind: "placement";
          id: string;
        } | {
          kind: "page-slot";
          page: {
            extensionId: string;
            kind: "page";
            id: string;
          };
          id: string;
        };
        resource?: {
          shorthand?: string | undefined;
          type: string;
          id: string;
          projectId?: string | undefined;
          label?: string | undefined;
          icon?: string | undefined;
          extensionId?: string | undefined;
          metadata?: JsonObject | undefined;
        } | undefined;
        open?: "pin" | "preview" | undefined;
      };
    }[];
    navigationTrees: {
      id: string;
      extensionId: string;
      owner: {
        extensionId: string;
        kind: "mode";
        id: string;
      } | {
        extensionId: string;
        kind: "page";
        id: string;
      };
      slot: "content" | "footer" | "header";
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      resourceScope?: "project" | "selection" | undefined;
    }[];
    statusBarItems: {
      id: string;
      extensionId: string;
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      slot: {
        id: string;
      };
      order?: number | undefined;
      when?: {
        mode?: {
          extensionId: string;
          kind: "mode";
          id: string;
        }[] | {
          extensionId: string;
          kind: "mode";
          id: string;
        } | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        view?: {
          extensionId: string;
          kind: "view";
          id: string;
        }[] | {
          extensionId: string;
          kind: "view";
          id: string;
        } | undefined;
        resourceType?: {
          extensionId: string;
          kind: "resource-kind";
          id: string;
        }[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
    }[];
    activityItems?: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon: string;
      modes: {
        extensionId: string;
        kind: "mode";
        id: string;
      }[];
      placement?: "default" | "first" | "last" | undefined;
      command: {
        extensionId: string;
        kind: "command";
        id: string;
      };
      params?: Record<string, unknown> | undefined;
    }[] | undefined;
    settingsSections?: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      scope?: "global" | "project" | undefined;
      order?: number | undefined;
    }[] | undefined;
    settingsPanels: {
      id: string;
      extensionId: string;
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      slot: {
        id: string;
      };
      section?: {
        extensionId: string;
        kind: "settings-section";
        id: string;
      } | undefined;
    }[];
    commandPaletteResources?: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      resourceKind?: string | undefined;
      queryHandlerId: string;
      refreshEventIds?: string[] | undefined;
    }[] | undefined;
    keybindings?: {
      id: string;
      extensionId: string;
      action: MetadataPageTarget | {
        kind: "command";
        target: {
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
          params?: JsonObject | undefined;
        };
      } | {
        kind: "href";
        href: string;
      } | {
        kind: "compound";
        targets: (MetadataPageTarget | {
          kind: "panel";
          panel: {
            extensionId: string;
            kind: "placement";
            id: string;
          } | {
            kind: "page-slot";
            page: {
              extensionId: string;
              kind: "page";
              id: string;
            };
            id: string;
          };
          resource?: {
            shorthand?: string | undefined;
            type: string;
            id: string;
            projectId?: string | undefined;
            label?: string | undefined;
            icon?: string | undefined;
            extensionId?: string | undefined;
            metadata?: JsonObject | undefined;
          } | undefined;
          open?: "pin" | "preview" | undefined;
        })[];
      } | {
        kind: "panel";
        panel: {
          extensionId: string;
          kind: "placement";
          id: string;
        } | {
          kind: "page-slot";
          page: {
            extensionId: string;
            kind: "page";
            id: string;
          };
          id: string;
        };
        resource?: {
          shorthand?: string | undefined;
          type: string;
          id: string;
          projectId?: string | undefined;
          label?: string | undefined;
          icon?: string | undefined;
          extensionId?: string | undefined;
          metadata?: JsonObject | undefined;
        } | undefined;
        open?: "pin" | "preview" | undefined;
      };
      key: string;
      canonicalChord: string;
      parsed: {
        key: string;
        ctrl: boolean;
        shift: boolean;
        alt: boolean;
        meta: boolean;
        modifiers: string[];
      };
      platformOverrides?: {
        mac?: string | undefined;
        linux?: string | undefined;
        win?: string | undefined;
      } | undefined;
      when?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
    }[] | undefined;
    settingsDefinitions?: {
      key: string;
      extensionId: string;
      type: "array" | "boolean" | "number" | "object" | "string";
      scope: "global" | "project";
      default?: unknown;
      enum?: unknown[] | undefined;
      options?: {
        commandId: string;
        valueField: string;
        labelField: string;
        params?: Record<string, unknown> | undefined;
      } | undefined;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    automations?: {
      id: string;
      localId: string;
      extensionId: string;
      extensionInstanceId?: string | undefined;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      cron: string;
      commandId: string;
      enabled: boolean;
    }[] | undefined;
    connections?: {
      id: string;
      localId: string;
      extensionId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      authType: "bearer" | "header";
      supportsCheck: boolean;
    }[] | undefined;
    harnesses?: {
      id: string;
      localId: string;
      extensionId: string;
      label?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    skills?: {
      id: string;
      localId: string;
      extensionId: string;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    templates?: {
      id: string;
      localId: string;
      extensionId: string;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    templateTypes?: {
      id: string;
      localId: string;
      extensionId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      order?: number | undefined;
      commands?: {
        list: string;
        read: string;
        save: string;
        delete: string;
      } | undefined;
    }[] | undefined;
    themes?: {
      id: string;
      localId: string;
      extensionId: string;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    diagnostics: {
      code: string;
      severity: "error" | "info" | "warning";
      message: string;
      extensionId?: string | undefined;
      commandId?: string | undefined;
      sourcePath?: string | undefined;
      metadata?: Record<string, unknown> | undefined;
    }[];
  }>;
  contributions: (projectId: string, instanceId: string) => Promise<{
    extensions: {
      id: string;
      name: string;
      displayName: string;
      extensionInstanceId?: string | undefined;
      installedExtensionId?: string | undefined;
      installName?: string | undefined;
      version?: string | undefined;
      description?: string | undefined;
      sourcePath: string;
    }[];
    commands: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      cliPath?: string | undefined;
      cliAliases?: string[] | undefined;
      examples?: string[] | undefined;
      automation?: boolean | undefined;
      mutating?: boolean | undefined;
      resourceMutation?: {
        kind: "rename";
        resourceType: string;
        idParam: string;
        labelParam: string;
      } | {
        kind: "remove";
        resourceType: string;
        idParam: string;
      } | undefined;
      params?: Record<string, {
        [x: string]: unknown;
        type: string;
      }> | undefined;
    }[];
    menuContributions: {
      id: string;
      extensionId: string;
      commandId: string;
      slotId: string;
      target?: "workbench.nav.actions" | "workbench.nav.overflow" | undefined;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      group?: string | undefined;
      placement?: "default" | "first" | "last" | undefined;
      icon?: string | undefined;
      presentation?: "button" | "icon-button" | "menu-item" | undefined;
      params?: Record<string, unknown> | undefined;
      when?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
      disabledWhen?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
      disabledReason?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[];
    commandPaletteContributions?: {
      id: string;
      extensionId: string;
      commandId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      group?: string | undefined;
      placement?: "default" | "first" | "last" | undefined;
      icon?: string | undefined;
      params?: Record<string, unknown> | undefined;
      when?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
    }[] | undefined;
    modes: {
      id: string;
      localId: string;
      extensionId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      regions: ("main" | "secondary" | "side")[];
      floatingPanels?: "hidden" | "visible" | undefined;
      regionSettings?: Partial<Record<"main" | "secondary" | "side" | "sidenav", {
        showHeader?: boolean | undefined;
        size?: {
          defaultPx?: number | undefined;
          minPx?: number | undefined;
          maxPx?: number | undefined;
        } | undefined;
        collapsible?: boolean | undefined;
        alwaysShowTabs?: boolean | undefined;
      }>> | undefined;
      defaultTheme?: {
        extensionId: string;
        kind: "theme";
        id: string;
      } | undefined;
      chrome?: Partial<Record<"activity" | "nav" | "sidenav" | "status", false | {
        extensionId: string;
        kind: "view";
        id: string;
      }>> | undefined;
    }[];
    pages: {
      id: string;
      localId: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      path: string;
      params?: Record<string, {
        type: "string";
        default?: string | undefined;
        values?: readonly string[] | undefined;
      } | {
        type: "number";
        default?: number | undefined;
      } | {
        type: "boolean";
        default?: boolean | undefined;
      } | {
        type: "string[]";
        default?: readonly string[] | undefined;
      }> | undefined;
      document?: {
        metadataKey: string;
      } | undefined;
      mode: {
        extensionId: string;
        kind: "mode";
        id: string;
      };
      parent?: {
        extensionId: string;
        kind: "page";
        id: string;
      } | undefined;
      resource?: {
        kinds: {
          extensionId: string;
          kind: "resource-kind";
          id: string;
        }[];
      } | undefined;
      main: {
        kind: "panels";
        empty: {
          extensionId: string;
          kind: "view";
          id: string;
        };
      } | {
        mountStrategy?: "active" | "keep-mounted" | undefined;
        hiddenByDefault?: boolean | undefined;
        headerBorderBottom?: boolean | undefined;
        tab?: {
          queryHandlerId: string;
          refreshEventIds?: string[] | undefined;
        } | undefined;
        kind: "view";
        view: {
          extensionId: string;
          kind: "view";
          id: string;
        };
        cardinality: "many" | "one";
      };
      slots: {
        mountStrategy?: "active" | "keep-mounted" | undefined;
        hiddenByDefault?: boolean | undefined;
        headerBorderBottom?: boolean | undefined;
        tab?: {
          queryHandlerId: string;
          refreshEventIds?: string[] | undefined;
        } | undefined;
        id: string;
        region: "main" | "secondary" | "side";
        order?: number | undefined;
        item: {
          kind: "view";
          view: {
            extensionId: string;
            kind: "view";
            id: string;
          };
          presence: "closed" | "fixed" | "open";
        } | {
          kind: "binding";
          binding: {
            kinds: {
              extensionId: string;
              kind: "resource-kind";
              id: string;
            }[];
            view: {
              extensionId: string;
              kind: "view";
              id: string;
            };
            cardinality: "many" | "one";
            add?: MetadataPageTarget | {
              kind: "command";
              target: {
                command: {
                  extensionId: string;
                  kind: "command";
                  id: string;
                };
                params?: JsonObject | undefined;
              };
            } | {
              kind: "href";
              href: string;
            } | {
              kind: "compound";
              targets: (MetadataPageTarget | {
                kind: "panel";
                panel: {
                  extensionId: string;
                  kind: "placement";
                  id: string;
                } | {
                  kind: "page-slot";
                  page: {
                    extensionId: string;
                    kind: "page";
                    id: string;
                  };
                  id: string;
                };
                resource?: {
                  shorthand?: string | undefined;
                  type: string;
                  id: string;
                  projectId?: string | undefined;
                  label?: string | undefined;
                  icon?: string | undefined;
                  extensionId?: string | undefined;
                  metadata?: JsonObject | undefined;
                } | undefined;
                open?: "pin" | "preview" | undefined;
              })[];
            } | {
              kind: "panel";
              panel: {
                extensionId: string;
                kind: "placement";
                id: string;
              } | {
                kind: "page-slot";
                page: {
                  extensionId: string;
                  kind: "page";
                  id: string;
                };
                id: string;
              };
              resource?: {
                shorthand?: string | undefined;
                type: string;
                id: string;
                projectId?: string | undefined;
                label?: string | undefined;
                icon?: string | undefined;
                extensionId?: string | undefined;
                metadata?: JsonObject | undefined;
              } | undefined;
              open?: "pin" | "preview" | undefined;
            } | undefined;
          };
        };
        openOn?: "page-resource" | undefined;
      }[];
    }[];
    views: {
      id: string;
      localId: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      body: {
        kind: "webview";
        webview: {
          entry: {
            kind: "package-asset";
            path: string;
            baseUrl: string;
          };
          title?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          capabilities?: string[] | undefined;
          runtimeUrl: string;
          moduleUrl: string;
          styles?: string[] | undefined;
        };
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        searchable?: boolean | undefined;
        searchPlaceholder?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        headerHandlerId?: string | undefined;
        bodyHandlerId: string;
        childrenHandlerId?: string | undefined;
        moveHandlerId?: string | undefined;
        footerHandlerId?: string | undefined;
        defaultExpandedSectionIds?: string[] | undefined;
        defaultExpandedNodeIds?: string[] | undefined;
        kind: "tree";
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        loadHandlerId: string;
        saveHandlerId?: string | undefined;
        kind: "file";
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        queryHandlerId: string;
        valueChangeHandlerId?: string | undefined;
        applyHandlerId?: string | undefined;
        resetHandlerId?: string | undefined;
        defaultValues?: Record<string, string | number | boolean | string[] | {
          x: number;
          y: number;
        } | {
          harnessId: string;
          model?: string | undefined;
          params?: Record<string, string | boolean> | undefined;
        } | [number, number] | null> | undefined;
        kind: "controls";
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        extensionInstanceId?: string | undefined;
        attributes?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          type: {
            kind: "enum";
            options: {
              value: string;
              label: string | {
                $l10n: string;
                default?: string | undefined;
              };
              color?: string | undefined;
              icon?: string | null | undefined;
            }[];
          } | {
            kind: "enum-multi";
            options: {
              value: string;
              label: string | {
                $l10n: string;
                default?: string | undefined;
              };
              color?: string | undefined;
              icon?: string | null | undefined;
            }[];
          } | {
            kind: "boolean";
            legacyValues?: Record<string, boolean> | undefined;
          } | {
            kind: "string";
          } | {
            kind: "date";
          } | {
            kind: "number";
          } | {
            kind: "user";
          };
          filterable?: boolean | undefined;
          groupable?: boolean | undefined;
          sortable?: boolean | undefined;
          displayable?: boolean | undefined;
          editable?: boolean | undefined;
          display?: {
            [x: string]: unknown;
            kind: string;
          } | {
            kind: "badge-list";
            itemsAttributeId: string;
          } | undefined;
        }[] | undefined;
        queryHandlerId: string;
        attributeChangeHandlerId?: string | undefined;
        moveHandlerId?: string | undefined;
        schemaRefreshEventIds?: string[] | undefined;
        columnActionHandlerId?: string | undefined;
        rowActivationHandlerId?: string | undefined;
        defaultSettings?: {
          viewMode?: "board" | "list" | undefined;
          columnGrouping?: string | undefined;
          rowGrouping?: string | undefined;
          displayProperties?: string[] | undefined;
        } | undefined;
        defaultFilter?: {
          conjunction: "and" | "or";
          rules: {
            attributeId: string;
            condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
            value?: string | number | boolean | string[] | undefined;
          }[];
          groups?: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
          }[] | undefined;
        } | undefined;
        defaultSorts?: {
          attributeId: string;
          direction: "asc" | "desc";
        }[] | undefined;
        defaultViews?: {
          id: string;
          title: string | {
            $l10n: string;
            default?: string | undefined;
          };
          settings: {
            viewMode: "board" | "list";
            columnGrouping: string;
            rowGrouping: string;
            displayProperties: string[];
          };
          filter: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
            groups?: {
              conjunction: "and" | "or";
              rules: {
                attributeId: string;
                condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
                value?: string | number | boolean | string[] | undefined;
              }[];
            }[] | undefined;
          };
          sorts: {
            attributeId: string;
            direction: "asc" | "desc";
          }[];
        }[] | undefined;
        defaultActiveViewId?: string | undefined;
        hideToolbar?: boolean | undefined;
        kind: "kanban";
        createRow?: {
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
          title?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          submitLabel?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          columnParam?: string | undefined;
          params?: Record<string, unknown> | undefined;
          attributesParam?: string | undefined;
          attachments?: {
            command: {
              extensionId: string;
              kind: "command";
              id: string;
            };
            resourceParam: string;
            fileParam: string;
          } | undefined;
          labels?: {
            cancel?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
            properties?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
            submitError?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
            removeFile?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
          } | undefined;
        } | undefined;
        rowActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          destructive?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
        toolbarActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          presentation?: "primary" | "secondary" | undefined;
          params?: Record<string, unknown> | undefined;
          input?: Record<string, {
            [x: string]: unknown;
            type: string;
          }> | undefined;
          submitLabel?: string | undefined;
          when?: string | undefined;
          disabled?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        columns?: {
          id: string;
          label?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          type?: "boolean" | "date" | "number" | "string" | undefined;
          groupable?: boolean | undefined;
          filterable?: boolean | undefined;
          description?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          icon?: string | undefined;
          hidden?: boolean | undefined;
          stat?: {
            type: "unique";
          } | {
            type: "histogram";
            bins?: number | undefined;
          } | {
            type: "top-values";
            limit?: number | undefined;
          } | undefined;
          renderer?: {
            type: "json";
          } | {
            type: "color-scale";
            stops: {
              value: number;
              color: {
                light: string;
                dark: string;
                foreground?: {
                  light: string;
                  dark: string;
                } | undefined;
              };
            }[];
          } | {
            type: "categorical-color";
            categories: {
              value: string | number | boolean | null;
              color: {
                light: string;
                dark: string;
                foreground?: {
                  light: string;
                  dark: string;
                } | undefined;
              };
            }[];
          } | undefined;
        }[] | undefined;
        queryHandlerId: string;
        selectionMode?: "multiple" | "none" | undefined;
        rowActivationHandlerId?: string | undefined;
        initialPageSize?: number | undefined;
        pageSizeOptions?: number[] | undefined;
        defaultSettings?: {
          grouping?: string | undefined;
          rowNumbers?: boolean | undefined;
          wrapRows?: boolean | undefined;
          showStats?: boolean | undefined;
          hiddenColumns?: string[] | undefined;
          columnOrder?: string[] | undefined;
        } | undefined;
        defaultFilter?: {
          conjunction: "and" | "or";
          rules: {
            attributeId: string;
            condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
            value?: string | number | boolean | string[] | undefined;
          }[];
          groups?: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
          }[] | undefined;
        } | undefined;
        defaultSorts?: {
          attributeId: string;
          direction: "asc" | "desc";
        }[] | undefined;
        defaultViews?: {
          id: string;
          title: string | {
            $l10n: string;
            default?: string | undefined;
          };
          settings?: {
            grouping?: string | undefined;
            rowNumbers?: boolean | undefined;
            wrapRows?: boolean | undefined;
            showStats?: boolean | undefined;
            hiddenColumns?: string[] | undefined;
            columnOrder?: string[] | undefined;
          } | undefined;
          filter?: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
            groups?: {
              conjunction: "and" | "or";
              rules: {
                attributeId: string;
                condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
                value?: string | number | boolean | string[] | undefined;
              }[];
            }[] | undefined;
          } | undefined;
          sorts?: {
            attributeId: string;
            direction: "asc" | "desc";
          }[] | undefined;
        }[] | undefined;
        defaultActiveViewId?: string | undefined;
        kind: "dataTable";
        selectionActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          destructive?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
        rowActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          destructive?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
        toolbarActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          presentation?: "primary" | "secondary" | undefined;
          params?: Record<string, unknown> | undefined;
          input?: Record<string, {
            [x: string]: unknown;
            type: string;
          }> | undefined;
          submitLabel?: string | undefined;
          when?: string | undefined;
          disabled?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
      };
    }[];
    viewMenus: {
      id: string;
      extensionId: string;
      owner: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      side: "left" | "right";
      group?: string | undefined;
      placement?: "default" | "first" | "last" | undefined;
      hostTreeHeader?: "default" | "none" | undefined;
      hostTreeFooter?: "default" | "none" | undefined;
    }[];
    placements: {
      mountStrategy?: "active" | "keep-mounted" | undefined;
      hiddenByDefault?: boolean | undefined;
      headerBorderBottom?: boolean | undefined;
      tab?: {
        queryHandlerId: string;
        refreshEventIds?: string[] | undefined;
      } | undefined;
      id: string;
      localId: string;
      extensionId: string;
      mode: {
        extensionId: string;
        kind: "mode";
        id: string;
      };
      item: {
        kind: "view";
        view: {
          extensionId: string;
          kind: "view";
          id: string;
        };
        presence: "closed" | "fixed" | "open";
      } | {
        kind: "binding";
        binding: {
          kinds: {
            extensionId: string;
            kind: "resource-kind";
            id: string;
          }[];
          view: {
            extensionId: string;
            kind: "view";
            id: string;
          };
          cardinality: "many" | "one";
          add?: MetadataPageTarget | {
            kind: "command";
            target: {
              command: {
                extensionId: string;
                kind: "command";
                id: string;
              };
              params?: JsonObject | undefined;
            };
          } | {
            kind: "href";
            href: string;
          } | {
            kind: "compound";
            targets: (MetadataPageTarget | {
              kind: "panel";
              panel: {
                extensionId: string;
                kind: "placement";
                id: string;
              } | {
                kind: "page-slot";
                page: {
                  extensionId: string;
                  kind: "page";
                  id: string;
                };
                id: string;
              };
              resource?: {
                shorthand?: string | undefined;
                type: string;
                id: string;
                projectId?: string | undefined;
                label?: string | undefined;
                icon?: string | undefined;
                extensionId?: string | undefined;
                metadata?: JsonObject | undefined;
              } | undefined;
              open?: "pin" | "preview" | undefined;
            })[];
          } | {
            kind: "panel";
            panel: {
              extensionId: string;
              kind: "placement";
              id: string;
            } | {
              kind: "page-slot";
              page: {
                extensionId: string;
                kind: "page";
                id: string;
              };
              id: string;
            };
            resource?: {
              shorthand?: string | undefined;
              type: string;
              id: string;
              projectId?: string | undefined;
              label?: string | undefined;
              icon?: string | undefined;
              extensionId?: string | undefined;
              metadata?: JsonObject | undefined;
            } | undefined;
            open?: "pin" | "preview" | undefined;
          } | undefined;
        };
      };
      region: "main" | "secondary" | "side";
      order?: number | undefined;
      movableTo?: ("main" | "secondary" | "side")[] | undefined;
    }[];
    resourceKinds: {
      id: string;
      localId: string;
      extensionId: string;
      label?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      icon?: string | undefined;
      resolveCommand?: string | undefined;
      resolveManyCommand?: string | undefined;
      paths?: {
        prefix: string;
        resolveCommand: string;
      }[] | undefined;
      menuSlots?: {
        id: string;
        placement: "context-menu" | "header-overflow" | "header-primary";
        label?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        access: "owner" | "public";
        order?: number | undefined;
      }[] | undefined;
    }[];
    resourceHierarchyProviders?: {
      id: string;
      extensionId: string;
      resourceKind: {
        extensionId: string;
        kind: "resource-kind";
        id: string;
      };
    }[] | undefined;
    navigationItems: {
      id: string;
      extensionId: string;
      owner: {
        extensionId: string;
        kind: "mode";
        id: string;
      } | {
        extensionId: string;
        kind: "page";
        id: string;
      };
      slot: "content" | "footer" | "header";
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      group?: string | undefined;
      when?: {
        mode?: {
          extensionId: string;
          kind: "mode";
          id: string;
        }[] | {
          extensionId: string;
          kind: "mode";
          id: string;
        } | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        view?: {
          extensionId: string;
          kind: "view";
          id: string;
        }[] | {
          extensionId: string;
          kind: "view";
          id: string;
        } | undefined;
        resourceType?: {
          extensionId: string;
          kind: "resource-kind";
          id: string;
        }[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
      action: MetadataPageTarget | {
        kind: "command";
        target: {
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
          params?: JsonObject | undefined;
        };
      } | {
        kind: "href";
        href: string;
      } | {
        kind: "compound";
        targets: (MetadataPageTarget | {
          kind: "panel";
          panel: {
            extensionId: string;
            kind: "placement";
            id: string;
          } | {
            kind: "page-slot";
            page: {
              extensionId: string;
              kind: "page";
              id: string;
            };
            id: string;
          };
          resource?: {
            shorthand?: string | undefined;
            type: string;
            id: string;
            projectId?: string | undefined;
            label?: string | undefined;
            icon?: string | undefined;
            extensionId?: string | undefined;
            metadata?: JsonObject | undefined;
          } | undefined;
          open?: "pin" | "preview" | undefined;
        })[];
      } | {
        kind: "panel";
        panel: {
          extensionId: string;
          kind: "placement";
          id: string;
        } | {
          kind: "page-slot";
          page: {
            extensionId: string;
            kind: "page";
            id: string;
          };
          id: string;
        };
        resource?: {
          shorthand?: string | undefined;
          type: string;
          id: string;
          projectId?: string | undefined;
          label?: string | undefined;
          icon?: string | undefined;
          extensionId?: string | undefined;
          metadata?: JsonObject | undefined;
        } | undefined;
        open?: "pin" | "preview" | undefined;
      };
    }[];
    navigationTrees: {
      id: string;
      extensionId: string;
      owner: {
        extensionId: string;
        kind: "mode";
        id: string;
      } | {
        extensionId: string;
        kind: "page";
        id: string;
      };
      slot: "content" | "footer" | "header";
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      resourceScope?: "project" | "selection" | undefined;
    }[];
    statusBarItems: {
      id: string;
      extensionId: string;
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      slot: {
        id: string;
      };
      order?: number | undefined;
      when?: {
        mode?: {
          extensionId: string;
          kind: "mode";
          id: string;
        }[] | {
          extensionId: string;
          kind: "mode";
          id: string;
        } | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        view?: {
          extensionId: string;
          kind: "view";
          id: string;
        }[] | {
          extensionId: string;
          kind: "view";
          id: string;
        } | undefined;
        resourceType?: {
          extensionId: string;
          kind: "resource-kind";
          id: string;
        }[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
    }[];
    activityItems?: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon: string;
      modes: {
        extensionId: string;
        kind: "mode";
        id: string;
      }[];
      placement?: "default" | "first" | "last" | undefined;
      command: {
        extensionId: string;
        kind: "command";
        id: string;
      };
      params?: Record<string, unknown> | undefined;
    }[] | undefined;
    settingsSections?: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      scope?: "global" | "project" | undefined;
      order?: number | undefined;
    }[] | undefined;
    settingsPanels: {
      id: string;
      extensionId: string;
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      slot: {
        id: string;
      };
      section?: {
        extensionId: string;
        kind: "settings-section";
        id: string;
      } | undefined;
    }[];
    commandPaletteResources?: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      resourceKind?: string | undefined;
      queryHandlerId: string;
      refreshEventIds?: string[] | undefined;
    }[] | undefined;
    keybindings?: {
      id: string;
      extensionId: string;
      action: MetadataPageTarget | {
        kind: "command";
        target: {
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
          params?: JsonObject | undefined;
        };
      } | {
        kind: "href";
        href: string;
      } | {
        kind: "compound";
        targets: (MetadataPageTarget | {
          kind: "panel";
          panel: {
            extensionId: string;
            kind: "placement";
            id: string;
          } | {
            kind: "page-slot";
            page: {
              extensionId: string;
              kind: "page";
              id: string;
            };
            id: string;
          };
          resource?: {
            shorthand?: string | undefined;
            type: string;
            id: string;
            projectId?: string | undefined;
            label?: string | undefined;
            icon?: string | undefined;
            extensionId?: string | undefined;
            metadata?: JsonObject | undefined;
          } | undefined;
          open?: "pin" | "preview" | undefined;
        })[];
      } | {
        kind: "panel";
        panel: {
          extensionId: string;
          kind: "placement";
          id: string;
        } | {
          kind: "page-slot";
          page: {
            extensionId: string;
            kind: "page";
            id: string;
          };
          id: string;
        };
        resource?: {
          shorthand?: string | undefined;
          type: string;
          id: string;
          projectId?: string | undefined;
          label?: string | undefined;
          icon?: string | undefined;
          extensionId?: string | undefined;
          metadata?: JsonObject | undefined;
        } | undefined;
        open?: "pin" | "preview" | undefined;
      };
      key: string;
      canonicalChord: string;
      parsed: {
        key: string;
        ctrl: boolean;
        shift: boolean;
        alt: boolean;
        meta: boolean;
        modifiers: string[];
      };
      platformOverrides?: {
        mac?: string | undefined;
        linux?: string | undefined;
        win?: string | undefined;
      } | undefined;
      when?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
    }[] | undefined;
    settingsDefinitions?: {
      key: string;
      extensionId: string;
      type: "array" | "boolean" | "number" | "object" | "string";
      scope: "global" | "project";
      default?: unknown;
      enum?: unknown[] | undefined;
      options?: {
        commandId: string;
        valueField: string;
        labelField: string;
        params?: Record<string, unknown> | undefined;
      } | undefined;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    automations?: {
      id: string;
      localId: string;
      extensionId: string;
      extensionInstanceId?: string | undefined;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      cron: string;
      commandId: string;
      enabled: boolean;
    }[] | undefined;
    connections?: {
      id: string;
      localId: string;
      extensionId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      authType: "bearer" | "header";
      supportsCheck: boolean;
    }[] | undefined;
    harnesses?: {
      id: string;
      localId: string;
      extensionId: string;
      label?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    skills?: {
      id: string;
      localId: string;
      extensionId: string;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    templates?: {
      id: string;
      localId: string;
      extensionId: string;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    templateTypes?: {
      id: string;
      localId: string;
      extensionId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      order?: number | undefined;
      commands?: {
        list: string;
        read: string;
        save: string;
        delete: string;
      } | undefined;
    }[] | undefined;
    themes?: {
      id: string;
      localId: string;
      extensionId: string;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    diagnostics: {
      code: string;
      severity: "error" | "info" | "warning";
      message: string;
      extensionId?: string | undefined;
      commandId?: string | undefined;
      sourcePath?: string | undefined;
      metadata?: Record<string, unknown> | undefined;
    }[];
  }>;
  marketplaceContributions: (projectId: string, installName: string) => Promise<{
    extensions: {
      id: string;
      name: string;
      displayName: string;
      extensionInstanceId?: string | undefined;
      installedExtensionId?: string | undefined;
      installName?: string | undefined;
      version?: string | undefined;
      description?: string | undefined;
      sourcePath: string;
    }[];
    commands: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      cliPath?: string | undefined;
      cliAliases?: string[] | undefined;
      examples?: string[] | undefined;
      automation?: boolean | undefined;
      mutating?: boolean | undefined;
      resourceMutation?: {
        kind: "rename";
        resourceType: string;
        idParam: string;
        labelParam: string;
      } | {
        kind: "remove";
        resourceType: string;
        idParam: string;
      } | undefined;
      params?: Record<string, {
        [x: string]: unknown;
        type: string;
      }> | undefined;
    }[];
    menuContributions: {
      id: string;
      extensionId: string;
      commandId: string;
      slotId: string;
      target?: "workbench.nav.actions" | "workbench.nav.overflow" | undefined;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      group?: string | undefined;
      placement?: "default" | "first" | "last" | undefined;
      icon?: string | undefined;
      presentation?: "button" | "icon-button" | "menu-item" | undefined;
      params?: Record<string, unknown> | undefined;
      when?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
      disabledWhen?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
      disabledReason?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[];
    commandPaletteContributions?: {
      id: string;
      extensionId: string;
      commandId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      group?: string | undefined;
      placement?: "default" | "first" | "last" | undefined;
      icon?: string | undefined;
      params?: Record<string, unknown> | undefined;
      when?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
    }[] | undefined;
    modes: {
      id: string;
      localId: string;
      extensionId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      regions: ("main" | "secondary" | "side")[];
      floatingPanels?: "hidden" | "visible" | undefined;
      regionSettings?: Partial<Record<"main" | "secondary" | "side" | "sidenav", {
        showHeader?: boolean | undefined;
        size?: {
          defaultPx?: number | undefined;
          minPx?: number | undefined;
          maxPx?: number | undefined;
        } | undefined;
        collapsible?: boolean | undefined;
        alwaysShowTabs?: boolean | undefined;
      }>> | undefined;
      defaultTheme?: {
        extensionId: string;
        kind: "theme";
        id: string;
      } | undefined;
      chrome?: Partial<Record<"activity" | "nav" | "sidenav" | "status", false | {
        extensionId: string;
        kind: "view";
        id: string;
      }>> | undefined;
    }[];
    pages: {
      id: string;
      localId: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      path: string;
      params?: Record<string, {
        type: "string";
        default?: string | undefined;
        values?: readonly string[] | undefined;
      } | {
        type: "number";
        default?: number | undefined;
      } | {
        type: "boolean";
        default?: boolean | undefined;
      } | {
        type: "string[]";
        default?: readonly string[] | undefined;
      }> | undefined;
      document?: {
        metadataKey: string;
      } | undefined;
      mode: {
        extensionId: string;
        kind: "mode";
        id: string;
      };
      parent?: {
        extensionId: string;
        kind: "page";
        id: string;
      } | undefined;
      resource?: {
        kinds: {
          extensionId: string;
          kind: "resource-kind";
          id: string;
        }[];
      } | undefined;
      main: {
        kind: "panels";
        empty: {
          extensionId: string;
          kind: "view";
          id: string;
        };
      } | {
        mountStrategy?: "active" | "keep-mounted" | undefined;
        hiddenByDefault?: boolean | undefined;
        headerBorderBottom?: boolean | undefined;
        tab?: {
          queryHandlerId: string;
          refreshEventIds?: string[] | undefined;
        } | undefined;
        kind: "view";
        view: {
          extensionId: string;
          kind: "view";
          id: string;
        };
        cardinality: "many" | "one";
      };
      slots: {
        mountStrategy?: "active" | "keep-mounted" | undefined;
        hiddenByDefault?: boolean | undefined;
        headerBorderBottom?: boolean | undefined;
        tab?: {
          queryHandlerId: string;
          refreshEventIds?: string[] | undefined;
        } | undefined;
        id: string;
        region: "main" | "secondary" | "side";
        order?: number | undefined;
        item: {
          kind: "view";
          view: {
            extensionId: string;
            kind: "view";
            id: string;
          };
          presence: "closed" | "fixed" | "open";
        } | {
          kind: "binding";
          binding: {
            kinds: {
              extensionId: string;
              kind: "resource-kind";
              id: string;
            }[];
            view: {
              extensionId: string;
              kind: "view";
              id: string;
            };
            cardinality: "many" | "one";
            add?: MetadataPageTarget | {
              kind: "command";
              target: {
                command: {
                  extensionId: string;
                  kind: "command";
                  id: string;
                };
                params?: JsonObject | undefined;
              };
            } | {
              kind: "href";
              href: string;
            } | {
              kind: "compound";
              targets: (MetadataPageTarget | {
                kind: "panel";
                panel: {
                  extensionId: string;
                  kind: "placement";
                  id: string;
                } | {
                  kind: "page-slot";
                  page: {
                    extensionId: string;
                    kind: "page";
                    id: string;
                  };
                  id: string;
                };
                resource?: {
                  shorthand?: string | undefined;
                  type: string;
                  id: string;
                  projectId?: string | undefined;
                  label?: string | undefined;
                  icon?: string | undefined;
                  extensionId?: string | undefined;
                  metadata?: JsonObject | undefined;
                } | undefined;
                open?: "pin" | "preview" | undefined;
              })[];
            } | {
              kind: "panel";
              panel: {
                extensionId: string;
                kind: "placement";
                id: string;
              } | {
                kind: "page-slot";
                page: {
                  extensionId: string;
                  kind: "page";
                  id: string;
                };
                id: string;
              };
              resource?: {
                shorthand?: string | undefined;
                type: string;
                id: string;
                projectId?: string | undefined;
                label?: string | undefined;
                icon?: string | undefined;
                extensionId?: string | undefined;
                metadata?: JsonObject | undefined;
              } | undefined;
              open?: "pin" | "preview" | undefined;
            } | undefined;
          };
        };
        openOn?: "page-resource" | undefined;
      }[];
    }[];
    views: {
      id: string;
      localId: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      body: {
        kind: "webview";
        webview: {
          entry: {
            kind: "package-asset";
            path: string;
            baseUrl: string;
          };
          title?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          capabilities?: string[] | undefined;
          runtimeUrl: string;
          moduleUrl: string;
          styles?: string[] | undefined;
        };
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        searchable?: boolean | undefined;
        searchPlaceholder?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        headerHandlerId?: string | undefined;
        bodyHandlerId: string;
        childrenHandlerId?: string | undefined;
        moveHandlerId?: string | undefined;
        footerHandlerId?: string | undefined;
        defaultExpandedSectionIds?: string[] | undefined;
        defaultExpandedNodeIds?: string[] | undefined;
        kind: "tree";
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        loadHandlerId: string;
        saveHandlerId?: string | undefined;
        kind: "file";
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        queryHandlerId: string;
        valueChangeHandlerId?: string | undefined;
        applyHandlerId?: string | undefined;
        resetHandlerId?: string | undefined;
        defaultValues?: Record<string, string | number | boolean | string[] | {
          x: number;
          y: number;
        } | {
          harnessId: string;
          model?: string | undefined;
          params?: Record<string, string | boolean> | undefined;
        } | [number, number] | null> | undefined;
        kind: "controls";
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        extensionInstanceId?: string | undefined;
        attributes?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          type: {
            kind: "enum";
            options: {
              value: string;
              label: string | {
                $l10n: string;
                default?: string | undefined;
              };
              color?: string | undefined;
              icon?: string | null | undefined;
            }[];
          } | {
            kind: "enum-multi";
            options: {
              value: string;
              label: string | {
                $l10n: string;
                default?: string | undefined;
              };
              color?: string | undefined;
              icon?: string | null | undefined;
            }[];
          } | {
            kind: "boolean";
            legacyValues?: Record<string, boolean> | undefined;
          } | {
            kind: "string";
          } | {
            kind: "date";
          } | {
            kind: "number";
          } | {
            kind: "user";
          };
          filterable?: boolean | undefined;
          groupable?: boolean | undefined;
          sortable?: boolean | undefined;
          displayable?: boolean | undefined;
          editable?: boolean | undefined;
          display?: {
            [x: string]: unknown;
            kind: string;
          } | {
            kind: "badge-list";
            itemsAttributeId: string;
          } | undefined;
        }[] | undefined;
        queryHandlerId: string;
        attributeChangeHandlerId?: string | undefined;
        moveHandlerId?: string | undefined;
        schemaRefreshEventIds?: string[] | undefined;
        columnActionHandlerId?: string | undefined;
        rowActivationHandlerId?: string | undefined;
        defaultSettings?: {
          viewMode?: "board" | "list" | undefined;
          columnGrouping?: string | undefined;
          rowGrouping?: string | undefined;
          displayProperties?: string[] | undefined;
        } | undefined;
        defaultFilter?: {
          conjunction: "and" | "or";
          rules: {
            attributeId: string;
            condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
            value?: string | number | boolean | string[] | undefined;
          }[];
          groups?: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
          }[] | undefined;
        } | undefined;
        defaultSorts?: {
          attributeId: string;
          direction: "asc" | "desc";
        }[] | undefined;
        defaultViews?: {
          id: string;
          title: string | {
            $l10n: string;
            default?: string | undefined;
          };
          settings: {
            viewMode: "board" | "list";
            columnGrouping: string;
            rowGrouping: string;
            displayProperties: string[];
          };
          filter: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
            groups?: {
              conjunction: "and" | "or";
              rules: {
                attributeId: string;
                condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
                value?: string | number | boolean | string[] | undefined;
              }[];
            }[] | undefined;
          };
          sorts: {
            attributeId: string;
            direction: "asc" | "desc";
          }[];
        }[] | undefined;
        defaultActiveViewId?: string | undefined;
        hideToolbar?: boolean | undefined;
        kind: "kanban";
        createRow?: {
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
          title?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          submitLabel?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          columnParam?: string | undefined;
          params?: Record<string, unknown> | undefined;
          attributesParam?: string | undefined;
          attachments?: {
            command: {
              extensionId: string;
              kind: "command";
              id: string;
            };
            resourceParam: string;
            fileParam: string;
          } | undefined;
          labels?: {
            cancel?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
            properties?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
            submitError?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
            removeFile?: string | {
              $l10n: string;
              default?: string | undefined;
            } | undefined;
          } | undefined;
        } | undefined;
        rowActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          destructive?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
        toolbarActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          presentation?: "primary" | "secondary" | undefined;
          params?: Record<string, unknown> | undefined;
          input?: Record<string, {
            [x: string]: unknown;
            type: string;
          }> | undefined;
          submitLabel?: string | undefined;
          when?: string | undefined;
          disabled?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
      } | {
        resourceKind?: string | undefined;
        refreshEventIds?: string[] | undefined;
        emptyTitle?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        emptyDescription?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        columns?: {
          id: string;
          label?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          type?: "boolean" | "date" | "number" | "string" | undefined;
          groupable?: boolean | undefined;
          filterable?: boolean | undefined;
          description?: string | {
            $l10n: string;
            default?: string | undefined;
          } | undefined;
          icon?: string | undefined;
          hidden?: boolean | undefined;
          stat?: {
            type: "unique";
          } | {
            type: "histogram";
            bins?: number | undefined;
          } | {
            type: "top-values";
            limit?: number | undefined;
          } | undefined;
          renderer?: {
            type: "json";
          } | {
            type: "color-scale";
            stops: {
              value: number;
              color: {
                light: string;
                dark: string;
                foreground?: {
                  light: string;
                  dark: string;
                } | undefined;
              };
            }[];
          } | {
            type: "categorical-color";
            categories: {
              value: string | number | boolean | null;
              color: {
                light: string;
                dark: string;
                foreground?: {
                  light: string;
                  dark: string;
                } | undefined;
              };
            }[];
          } | undefined;
        }[] | undefined;
        queryHandlerId: string;
        selectionMode?: "multiple" | "none" | undefined;
        rowActivationHandlerId?: string | undefined;
        initialPageSize?: number | undefined;
        pageSizeOptions?: number[] | undefined;
        defaultSettings?: {
          grouping?: string | undefined;
          rowNumbers?: boolean | undefined;
          wrapRows?: boolean | undefined;
          showStats?: boolean | undefined;
          hiddenColumns?: string[] | undefined;
          columnOrder?: string[] | undefined;
        } | undefined;
        defaultFilter?: {
          conjunction: "and" | "or";
          rules: {
            attributeId: string;
            condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
            value?: string | number | boolean | string[] | undefined;
          }[];
          groups?: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
          }[] | undefined;
        } | undefined;
        defaultSorts?: {
          attributeId: string;
          direction: "asc" | "desc";
        }[] | undefined;
        defaultViews?: {
          id: string;
          title: string | {
            $l10n: string;
            default?: string | undefined;
          };
          settings?: {
            grouping?: string | undefined;
            rowNumbers?: boolean | undefined;
            wrapRows?: boolean | undefined;
            showStats?: boolean | undefined;
            hiddenColumns?: string[] | undefined;
            columnOrder?: string[] | undefined;
          } | undefined;
          filter?: {
            conjunction: "and" | "or";
            rules: {
              attributeId: string;
              condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
              value?: string | number | boolean | string[] | undefined;
            }[];
            groups?: {
              conjunction: "and" | "or";
              rules: {
                attributeId: string;
                condition: "contains" | "does-not-contain" | "gt" | "gte" | "has-all-of" | "has-any-of" | "has-none-of" | "is" | "is-after" | "is-any-of" | "is-before" | "is-empty" | "is-none-of" | "is-not" | "is-not-empty" | "is-on-or-after" | "is-on-or-before" | "lt" | "lte";
                value?: string | number | boolean | string[] | undefined;
              }[];
            }[] | undefined;
          } | undefined;
          sorts?: {
            attributeId: string;
            direction: "asc" | "desc";
          }[] | undefined;
        }[] | undefined;
        defaultActiveViewId?: string | undefined;
        kind: "dataTable";
        selectionActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          destructive?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
        rowActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          destructive?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
        toolbarActions?: {
          id: string;
          label: string | {
            $l10n: string;
            default?: string | undefined;
          };
          icon?: string | undefined;
          presentation?: "primary" | "secondary" | undefined;
          params?: Record<string, unknown> | undefined;
          input?: Record<string, {
            [x: string]: unknown;
            type: string;
          }> | undefined;
          submitLabel?: string | undefined;
          when?: string | undefined;
          disabled?: boolean | undefined;
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
        }[] | undefined;
      };
    }[];
    viewMenus: {
      id: string;
      extensionId: string;
      owner: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      side: "left" | "right";
      group?: string | undefined;
      placement?: "default" | "first" | "last" | undefined;
      hostTreeHeader?: "default" | "none" | undefined;
      hostTreeFooter?: "default" | "none" | undefined;
    }[];
    placements: {
      mountStrategy?: "active" | "keep-mounted" | undefined;
      hiddenByDefault?: boolean | undefined;
      headerBorderBottom?: boolean | undefined;
      tab?: {
        queryHandlerId: string;
        refreshEventIds?: string[] | undefined;
      } | undefined;
      id: string;
      localId: string;
      extensionId: string;
      mode: {
        extensionId: string;
        kind: "mode";
        id: string;
      };
      item: {
        kind: "view";
        view: {
          extensionId: string;
          kind: "view";
          id: string;
        };
        presence: "closed" | "fixed" | "open";
      } | {
        kind: "binding";
        binding: {
          kinds: {
            extensionId: string;
            kind: "resource-kind";
            id: string;
          }[];
          view: {
            extensionId: string;
            kind: "view";
            id: string;
          };
          cardinality: "many" | "one";
          add?: MetadataPageTarget | {
            kind: "command";
            target: {
              command: {
                extensionId: string;
                kind: "command";
                id: string;
              };
              params?: JsonObject | undefined;
            };
          } | {
            kind: "href";
            href: string;
          } | {
            kind: "compound";
            targets: (MetadataPageTarget | {
              kind: "panel";
              panel: {
                extensionId: string;
                kind: "placement";
                id: string;
              } | {
                kind: "page-slot";
                page: {
                  extensionId: string;
                  kind: "page";
                  id: string;
                };
                id: string;
              };
              resource?: {
                shorthand?: string | undefined;
                type: string;
                id: string;
                projectId?: string | undefined;
                label?: string | undefined;
                icon?: string | undefined;
                extensionId?: string | undefined;
                metadata?: JsonObject | undefined;
              } | undefined;
              open?: "pin" | "preview" | undefined;
            })[];
          } | {
            kind: "panel";
            panel: {
              extensionId: string;
              kind: "placement";
              id: string;
            } | {
              kind: "page-slot";
              page: {
                extensionId: string;
                kind: "page";
                id: string;
              };
              id: string;
            };
            resource?: {
              shorthand?: string | undefined;
              type: string;
              id: string;
              projectId?: string | undefined;
              label?: string | undefined;
              icon?: string | undefined;
              extensionId?: string | undefined;
              metadata?: JsonObject | undefined;
            } | undefined;
            open?: "pin" | "preview" | undefined;
          } | undefined;
        };
      };
      region: "main" | "secondary" | "side";
      order?: number | undefined;
      movableTo?: ("main" | "secondary" | "side")[] | undefined;
    }[];
    resourceKinds: {
      id: string;
      localId: string;
      extensionId: string;
      label?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      icon?: string | undefined;
      resolveCommand?: string | undefined;
      resolveManyCommand?: string | undefined;
      paths?: {
        prefix: string;
        resolveCommand: string;
      }[] | undefined;
      menuSlots?: {
        id: string;
        placement: "context-menu" | "header-overflow" | "header-primary";
        label?: string | {
          $l10n: string;
          default?: string | undefined;
        } | undefined;
        access: "owner" | "public";
        order?: number | undefined;
      }[] | undefined;
    }[];
    resourceHierarchyProviders?: {
      id: string;
      extensionId: string;
      resourceKind: {
        extensionId: string;
        kind: "resource-kind";
        id: string;
      };
    }[] | undefined;
    navigationItems: {
      id: string;
      extensionId: string;
      owner: {
        extensionId: string;
        kind: "mode";
        id: string;
      } | {
        extensionId: string;
        kind: "page";
        id: string;
      };
      slot: "content" | "footer" | "header";
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon?: string | undefined;
      group?: string | undefined;
      when?: {
        mode?: {
          extensionId: string;
          kind: "mode";
          id: string;
        }[] | {
          extensionId: string;
          kind: "mode";
          id: string;
        } | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        view?: {
          extensionId: string;
          kind: "view";
          id: string;
        }[] | {
          extensionId: string;
          kind: "view";
          id: string;
        } | undefined;
        resourceType?: {
          extensionId: string;
          kind: "resource-kind";
          id: string;
        }[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
      action: MetadataPageTarget | {
        kind: "command";
        target: {
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
          params?: JsonObject | undefined;
        };
      } | {
        kind: "href";
        href: string;
      } | {
        kind: "compound";
        targets: (MetadataPageTarget | {
          kind: "panel";
          panel: {
            extensionId: string;
            kind: "placement";
            id: string;
          } | {
            kind: "page-slot";
            page: {
              extensionId: string;
              kind: "page";
              id: string;
            };
            id: string;
          };
          resource?: {
            shorthand?: string | undefined;
            type: string;
            id: string;
            projectId?: string | undefined;
            label?: string | undefined;
            icon?: string | undefined;
            extensionId?: string | undefined;
            metadata?: JsonObject | undefined;
          } | undefined;
          open?: "pin" | "preview" | undefined;
        })[];
      } | {
        kind: "panel";
        panel: {
          extensionId: string;
          kind: "placement";
          id: string;
        } | {
          kind: "page-slot";
          page: {
            extensionId: string;
            kind: "page";
            id: string;
          };
          id: string;
        };
        resource?: {
          shorthand?: string | undefined;
          type: string;
          id: string;
          projectId?: string | undefined;
          label?: string | undefined;
          icon?: string | undefined;
          extensionId?: string | undefined;
          metadata?: JsonObject | undefined;
        } | undefined;
        open?: "pin" | "preview" | undefined;
      };
    }[];
    navigationTrees: {
      id: string;
      extensionId: string;
      owner: {
        extensionId: string;
        kind: "mode";
        id: string;
      } | {
        extensionId: string;
        kind: "page";
        id: string;
      };
      slot: "content" | "footer" | "header";
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      resourceScope?: "project" | "selection" | undefined;
    }[];
    statusBarItems: {
      id: string;
      extensionId: string;
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      slot: {
        id: string;
      };
      order?: number | undefined;
      when?: {
        mode?: {
          extensionId: string;
          kind: "mode";
          id: string;
        }[] | {
          extensionId: string;
          kind: "mode";
          id: string;
        } | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        view?: {
          extensionId: string;
          kind: "view";
          id: string;
        }[] | {
          extensionId: string;
          kind: "view";
          id: string;
        } | undefined;
        resourceType?: {
          extensionId: string;
          kind: "resource-kind";
          id: string;
        }[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
    }[];
    activityItems?: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      icon: string;
      modes: {
        extensionId: string;
        kind: "mode";
        id: string;
      }[];
      placement?: "default" | "first" | "last" | undefined;
      command: {
        extensionId: string;
        kind: "command";
        id: string;
      };
      params?: Record<string, unknown> | undefined;
    }[] | undefined;
    settingsSections?: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      scope?: "global" | "project" | undefined;
      order?: number | undefined;
    }[] | undefined;
    settingsPanels: {
      id: string;
      extensionId: string;
      view: {
        extensionId: string;
        kind: "view";
        id: string;
      };
      slot: {
        id: string;
      };
      section?: {
        extensionId: string;
        kind: "settings-section";
        id: string;
      } | undefined;
    }[];
    commandPaletteResources?: {
      id: string;
      extensionId: string;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      resourceKind?: string | undefined;
      queryHandlerId: string;
      refreshEventIds?: string[] | undefined;
    }[] | undefined;
    keybindings?: {
      id: string;
      extensionId: string;
      action: MetadataPageTarget | {
        kind: "command";
        target: {
          command: {
            extensionId: string;
            kind: "command";
            id: string;
          };
          params?: JsonObject | undefined;
        };
      } | {
        kind: "href";
        href: string;
      } | {
        kind: "compound";
        targets: (MetadataPageTarget | {
          kind: "panel";
          panel: {
            extensionId: string;
            kind: "placement";
            id: string;
          } | {
            kind: "page-slot";
            page: {
              extensionId: string;
              kind: "page";
              id: string;
            };
            id: string;
          };
          resource?: {
            shorthand?: string | undefined;
            type: string;
            id: string;
            projectId?: string | undefined;
            label?: string | undefined;
            icon?: string | undefined;
            extensionId?: string | undefined;
            metadata?: JsonObject | undefined;
          } | undefined;
          open?: "pin" | "preview" | undefined;
        })[];
      } | {
        kind: "panel";
        panel: {
          extensionId: string;
          kind: "placement";
          id: string;
        } | {
          kind: "page-slot";
          page: {
            extensionId: string;
            kind: "page";
            id: string;
          };
          id: string;
        };
        resource?: {
          shorthand?: string | undefined;
          type: string;
          id: string;
          projectId?: string | undefined;
          label?: string | undefined;
          icon?: string | undefined;
          extensionId?: string | undefined;
          metadata?: JsonObject | undefined;
        } | undefined;
        open?: "pin" | "preview" | undefined;
      };
      key: string;
      canonicalChord: string;
      parsed: {
        key: string;
        ctrl: boolean;
        shift: boolean;
        alt: boolean;
        meta: boolean;
        modifiers: string[];
      };
      platformOverrides?: {
        mac?: string | undefined;
        linux?: string | undefined;
        win?: string | undefined;
      } | undefined;
      when?: {
        mode?: string | string[] | undefined;
        source?: ("api" | "automation" | "cli" | "command-panel" | "dashboard" | "event" | "schedule")[] | undefined;
        viewId?: string | string[] | undefined;
        resourceType?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
      } | undefined;
    }[] | undefined;
    settingsDefinitions?: {
      key: string;
      extensionId: string;
      type: "array" | "boolean" | "number" | "object" | "string";
      scope: "global" | "project";
      default?: unknown;
      enum?: unknown[] | undefined;
      options?: {
        commandId: string;
        valueField: string;
        labelField: string;
        params?: Record<string, unknown> | undefined;
      } | undefined;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    automations?: {
      id: string;
      localId: string;
      extensionId: string;
      extensionInstanceId?: string | undefined;
      title: string | {
        $l10n: string;
        default?: string | undefined;
      };
      cron: string;
      commandId: string;
      enabled: boolean;
    }[] | undefined;
    connections?: {
      id: string;
      localId: string;
      extensionId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      authType: "bearer" | "header";
      supportsCheck: boolean;
    }[] | undefined;
    harnesses?: {
      id: string;
      localId: string;
      extensionId: string;
      label?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    skills?: {
      id: string;
      localId: string;
      extensionId: string;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    templates?: {
      id: string;
      localId: string;
      extensionId: string;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    templateTypes?: {
      id: string;
      localId: string;
      extensionId: string;
      label: string | {
        $l10n: string;
        default?: string | undefined;
      };
      description?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
      order?: number | undefined;
      commands?: {
        list: string;
        read: string;
        save: string;
        delete: string;
      } | undefined;
    }[] | undefined;
    themes?: {
      id: string;
      localId: string;
      extensionId: string;
      title?: string | {
        $l10n: string;
        default?: string | undefined;
      } | undefined;
    }[] | undefined;
    diagnostics: {
      code: string;
      severity: "error" | "info" | "warning";
      message: string;
      extensionId?: string | undefined;
      commandId?: string | undefined;
      sourcePath?: string | undefined;
      metadata?: Record<string, unknown> | undefined;
    }[];
  }>;
  setEnabled: (projectId: string, instanceId: string, enabled: boolean) => Promise<{
    id: string;
    projectId: string;
    extensionId: string;
    installedExtensionId: string;
    installName: string;
    name: string;
    displayName: string;
    version?: string | null | undefined;
    description?: string | undefined;
    sourcePath: string;
    scope: "global" | "repo";
    status: "disabled" | "error" | "loaded" | "missing" | "pending";
    lastLoadedAt?: string | null | undefined;
    lastError?: Record<string, unknown> | null | undefined;
    enabled: boolean;
    config: Record<string, unknown>;
    canUpgrade: boolean;
    updateAvailable: boolean;
  }>;
  setAutomationEnabled: (projectId: string, instanceId: string, automationId: string, enabled: boolean) => Promise<{
    id: string;
    localId: string;
    extensionId: string;
    extensionInstanceId?: string | undefined;
    title: string | {
      $l10n: string;
      default?: string | undefined;
    };
    cron: string;
    commandId: string;
    enabled: boolean;
  }>;
  reload: (projectId: string, instanceId: string) => Promise<{
    id: string;
    projectId: string;
    extensionId: string;
    installedExtensionId: string;
    installName: string;
    name: string;
    displayName: string;
    version?: string | null | undefined;
    description?: string | undefined;
    sourcePath: string;
    scope: "global" | "repo";
    status: "disabled" | "error" | "loaded" | "missing" | "pending";
    lastLoadedAt?: string | null | undefined;
    lastError?: Record<string, unknown> | null | undefined;
    enabled: boolean;
    config: Record<string, unknown>;
    canUpgrade: boolean;
    updateAvailable: boolean;
  }>;
  uninstall: (projectId: string, instanceId: string, deleteUserData?: boolean) => Promise<void>;
  uploadCommandFile: (projectId: string, commandId: string, input: {
    name: string;
    data: Uint8Array | ArrayBuffer;
    mimeType?: string;
  }) => Promise<ExtensionBlobRef>;
  artifacts: {
    list: (projectId: string, instanceId: string, mountId: string, prefix?: string) => Promise<{
      files: WebviewArtifactFile[];
    }>;
    readText: (projectId: string, instanceId: string, mountId: string, path: string) => Promise<{
      content: string;
    }>;
    imageUrl: (projectId: string, instanceId: string, mountId: string, path: string, webviewId: string) => Promise<{
      url: string;
    }>;
  };
};
type CommandStreamClientEvent = {
  type: "data";
  data: JsonValue;
} | {
  type: "end";
  response: CommandExecuteResponse;
};
type ExtensionClient = ReturnType<typeof createExtensionControlsClient> & ReturnType<typeof createExtensionManagementClient> & {
  install(projectId: string, input: InstallExtensionRequest | {
    upload: FormData;
  }, options?: {
    signal?: AbortSignal;
  }): Promise<InstallExtensionResponse>;
  diagnostics(projectId: string, options?: {
    scope?: "user" | "repo";
  }): Promise<ExtensionDiagnosticsResponse>;
  stream(commandId: string, input: CommandExecuteRequest, options?: {
    signal?: AbortSignal;
  }): AsyncIterable<CommandStreamClientEvent>;
  enableInstalled(projectId: string, installName: string, request: EnableInstalledExtensionRequest): Promise<EnableInstalledExtensionResponse>;
  listAppearance(projectId: string): Promise<ListExtensionAppearanceResponse>;
  listCommands(projectId: string): Promise<ListExtensionCommandsResponse>;
  listProject(projectId: string): Promise<ListProjectExtensionsResponse>;
  upgradeProject(projectId: string, instanceId: string): Promise<UpgradeProjectExtensionResponse>;
  listConnections(projectId: string): Promise<ListExtensionConnectionsResponse>;
  configureConnection(projectId: string, extensionId: string, connectionId: string, input: ConfigureExtensionConnectionInput): Promise<ExtensionConnectionRecord>;
  checkConnection(projectId: string, extensionId: string, connectionId: string): Promise<ExtensionConnectionRecord>;
  deleteConnection(projectId: string, extensionId: string, connectionId: string): Promise<void>;
  execute(commandId: string, request: CommandExecuteRequest, options?: {
    signal?: AbortSignal;
  }): Promise<CommandExecuteResponse>;
  dispatchEvent(projectId: string, input: DispatchExtensionEventInput): Promise<void>;
};
interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}
declare const createFilesystemClient: (request: RequestFn) => {
  list: (path?: string) => Promise<{
    currentPath: string;
    entries: DirectoryEntry[];
  }>;
  createDirectory: (input: {
    parent_path: string;
    name: string;
  }) => Promise<{
    path: string;
  }>;
};
type FilesystemClient = ReturnType<typeof createFilesystemClient>;
type NotificationsClient = {
  list(projectId: string, query?: ListNotificationsQuery): Promise<ListNotificationsResponse>;
  count(projectId: string, query?: Pick<ListNotificationsQuery, "status" | "priority" | "sourceExtensionId">): Promise<{
    count: number;
  }>;
  get(projectId: string, id: string): Promise<Notification>;
  create(input: CreateNotificationInput): Promise<Notification>;
  update(projectId: string, id: string, input: UpdateNotificationInput): Promise<Notification>;
  markRead(projectId: string, id: string): Promise<Notification>;
  dismiss(projectId: string, id: string): Promise<Notification>;
  markDone(projectId: string, id: string): Promise<Notification>;
  snooze(projectId: string, id: string, until: string): Promise<Notification>;
  resolveByDedupeKey(projectId: string, input: {
    dedupeKey: string;
    status?: Extract<NotificationStatus, "done" | "dismissed" | "expired">;
  }): Promise<{
    resolved: number;
    notifications: Notification[];
  }>;
};
type ProjectClient = {
  list(): Promise<Project[]>;
  get(projectId: string): Promise<Project>;
  create(input: CreateProjectInput): Promise<Project>;
  bindEnvironment(workbenchId: string, input: BindEnvironmentInput): Promise<EnvironmentBinding>;
  attachInitialWorkspace(projectId: string, input: CreateProjectInput["initial_workspace"]): Promise<Workspace$1>;
  retrySetup(projectId: string): Promise<Workspace$1>;
  update(projectId: string, input: UpdateProjectInput): Promise<Project>;
  delete(projectId: string): Promise<void>;
};
interface ResourceAnchorsClient {
  addAnchors(projectId: string, resource: ResourceRef, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(projectId: string, resource: ResourceRef, refs: ResourceRef[]): Promise<void>;
  listAnchors(projectId: string, input: ResourceAnchorQuery): Promise<ResourceAnchorPage>;
}
type RuntimeClient = {
  ready: () => Promise<RuntimeReadyResponse>;
  claimBrowserSession: (code: string) => Promise<{
    secret: string;
  }>;
  environment: () => Promise<EnvironmentIdentity>;
  resolveTarget: (target: EnvironmentTarget) => Promise<Workspace$1>;
  createBrowserLogin: () => Promise<{
    url: string;
  }>;
};
export declare const createRuntimeClient: (request: RequestFn) => RuntimeClient;
type SseEvent = {
  event: string;
  data: string;
};
type ListSessionsInput = {
  status?: string;
  agent?: string;
  workspaceId?: string;
  archived?: boolean;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  anchorType?: string;
  anchorId?: string;
};
type SessionClient = {
  getDraftHarnessCommands(input: DraftHarnessCommandInput, signal?: AbortSignal): Promise<HarnessCommandState & {
    harnessId: string;
  }>;
  list(projectId: string, input?: ListSessionsInput): Promise<Session[]>;
  get(sessionId: string): Promise<Session>;
  getHarnessCommands(sessionId: string, signal?: AbortSignal): Promise<HarnessCommandState & {
    harnessId: string;
  }>;
  invokeHarnessOperation(sessionId: string, operation: HarnessOperation, harnessId?: string): Promise<{
    status: "completed" | "started";
    message?: string;
  }>;
  uploadAttachment(projectId: string, input: {
    name: string;
    data: Uint8Array | ArrayBuffer;
    mimeType?: string | null;
  }): Promise<SessionAttachment>;
  deleteAttachment(projectId: string, fileId: string): Promise<void>;
  create(input: CreateSessionInput): Promise<CreateSessionResponse>;
  archive(sessionId: string): Promise<void>;
  delete(sessionId: string): Promise<void>;
  followUp(sessionId: string, input: FollowUpInput): Promise<FollowUpResponse>;
  approve(sessionId: string, input: ApprovalInput): Promise<void>;
  getConversation(sessionId: string, signal?: AbortSignal): Promise<SessionConversationResponse>;
  /** @deprecated */
  getConversationSources(sessionId: string, signal?: AbortSignal): Promise<SessionConversationSources>;
  getQueuedMessages(sessionId: string, options?: {
    signal?: AbortSignal;
  }): Promise<SessionQueuedMessagesResponse>;
  steerQueuedFollowUp(sessionId: string, queuePosition: number, input: SteerQueuedFollowUpInput): Promise<QueuedSteeringResult>;
  getQueuedFollowUps(sessionId: string): Promise<PendingQueuedFollowUpsResponse>;
  updateQueuedFollowUp(sessionId: string, queuePosition: number, input: UpdateQueuedFollowUpInput): Promise<QueuedFollowUpUpdateResponse>;
  combineQueuedFollowUps(sessionId: string, queuePosition: number, input: CombineQueuedFollowUpsInput): Promise<QueuedFollowUpUpdateResponse>;
  removeQueuedFollowUp(sessionId: string, queuePosition: number, expectedRevision?: string): Promise<{
    ok: true;
  }>;
  moveQueuedFollowUp(sessionId: string, queuePosition: number, input: {
    direction: "up" | "down";
    expectedRevision?: string;
    steps?: number;
    expectedOrder?: {
      queuePosition: number;
      revision: string;
    }[];
  }): Promise<{
    ok: true;
    queuePosition: number;
  }>;
  resolveSessionId(input: ResolveSessionIdInput): Promise<ResolveSessionIdResponse>;
  updateStatus(sessionId: string, status: string): Promise<Session>;
  rename(sessionId: string, title: string): Promise<Session>;
  /** @deprecated */
  listActivity(sessionId: string, input?: ListSessionActivityInput): Promise<ListSessionActivityResponse>;
  stream(sessionId: string, onEvent: (event: SseEvent) => void, options?: {
    signal?: AbortSignal;
  }): Promise<void>;
  connectStream(sessionId: string, handlers: SessionStreamHandlers): SessionStreamConnection;
};
type SessionStreamHandlers = {
  onReady?: (data: unknown) => void;
  onPatch?: (data: unknown) => void;
  onApprovalRequest?: (data: unknown) => void;
  onQueuedMessages?: (data: SessionQueuedMessagesResponse | {
    error: string;
  }) => void;
  onEnd?: (data: unknown) => void;
  onError?: (error: unknown) => void;
};
type SessionStreamConnection = {
  close: () => void;
};
type SettingsClient = {
  get(): Promise<Settings>;
  update(input: UpdateSettingsInput): Promise<Settings>;
};
type SkillClient = {
  list(projectId: string): Promise<Skill[]>;
  get(projectId: string, skillId: string): Promise<SkillWithContent>;
  /** @deprecated */
  updatePreferences(projectId: string, skillName: string, input: UpdateSkillInput): Promise<Skill>;
};
type SyncRow = {
  id: string;
  [key: string]: unknown;
};
type SyncWriter = {
  truncateAndWrite: (rows: SyncRow[]) => void;
  upsert: (row: SyncRow) => void;
  remove: (id: string) => void;
};
type SyncWriterProvider = {
  getWriter: (table: string) => SyncWriter | undefined;
};
type SyncConnection = {
  close: () => void;
  connected: boolean;
};
type StartSyncInput = SyncWriterProvider & {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onConnectionLost?: () => void;
  heartbeatIntervalMs?: number;
  heartbeatThreshold?: number;
  reconnectDelayMs?: number;
};
type SyncClient = {
  start: (input: StartSyncInput) => SyncConnection;
};
export declare const parseSyncDeleteEvent: (data: string) => {
  table: string;
  id: string;
  seq: number;
};
export declare const applySyncEvent: (event: string, data: string, writers: SyncWriterProvider) => number | null;
declare const createWorkspaceDiffClient: (request: RequestFn) => {
  diffFiles: (id: string, mode: "current" | "fork_point", signal?: AbortSignal) => Promise<{
    workspace_id: string;
    base_ref: string;
    head_ref: string;
    totals: {
      additions: number;
      deletions: number;
      file_count: number;
    };
    files: {
      filePath: string;
      change: "added" | "copied" | "deleted" | "modified" | "permissionChange" | "renamed";
      additions: number;
      deletions: number;
      oldPath?: string | undefined;
      newPath?: string | undefined;
    }[];
  } | null>;
  diffFile: (id: string, mode: "current" | "fork_point", file: string, signal?: AbortSignal) => Promise<{
    filePath: string;
    change: "added" | "copied" | "deleted" | "modified" | "permissionChange" | "renamed";
    additions: number;
    deletions: number;
    oldContent: string;
    newContent: string;
    oldPath?: string | undefined;
    newPath?: string | undefined;
  } | null>;
  diffSummary: (id: string, mode: "current" | "fork_point", signal?: AbortSignal) => Promise<{
    workspace_id: string;
    additions: number;
    deletions: number;
    file_count: number;
  } | null>;
};
type WorkspaceClient = ReturnType<typeof createWorkspaceDiffClient> & {
  listProviders(projectId: string, options?: {
    signal?: AbortSignal;
  }): Promise<WorkspaceProviderDescriptor[]>;
  list(projectId: string): Promise<WorkspaceListItem$1[]>;
  getByShorthand(projectId: string, shorthand: string): Promise<Workspace$1>;
  create(input: CreateWorkspaceInput): Promise<Workspace$1>;
  rename(workspaceId: string, input: RenameWorkspaceInput): Promise<Workspace$1>;
  /** @deprecated */
  listActivity(workspaceId: string, input?: ListWorkspaceActivityInput): Promise<ListWorkspaceActivityResponse>;
  listFiles(workspaceId: string, input?: ListWorkspaceFilesInput, options?: {
    signal?: AbortSignal;
  }): Promise<WorkspaceFilesResponse>;
  createDirectory(workspaceId: string, path: string): Promise<WorkspaceFileEntry>;
  createFile(workspaceId: string, path: string, input: WriteWorkspaceFileInput): Promise<WorkspaceFileContent>;
  readFile(workspaceId: string, path: string, options?: {
    signal?: AbortSignal;
  }): Promise<WorkspaceFileContent>;
  writeFile(workspaceId: string, path: string, input: WriteWorkspaceFileInput): Promise<WorkspaceFileContent>;
  moveEntry(workspaceId: string, path: string, destinationPath: string): Promise<void>;
  deleteEntry(workspaceId: string, path: string): Promise<void>;
  removeWorktree(workspaceId: string): Promise<RemoveWorktreeResponse>;
  delete(workspaceId: string): Promise<void>;
};
type PstdioClient = {
  assets: AssetsClient;
  resources: ResourceAnchorsClient;
  views: BoardViewsClient;
  projects: ProjectClient;
  filesystem: FilesystemClient;
  workspaces: WorkspaceClient;
  sessions: SessionClient;
  skills: SkillClient;
  agents: AgentClient;
  automation: AutomationClient;
  notifications: NotificationsClient;
  extensions: ExtensionClient;
  settings: SettingsClient;
  sync: SyncClient;
  runtime: RuntimeClient;
};
export declare const createClient: (options?: ClientOptions) => PstdioClient;
/** @deprecated */
type AssetReference = AssetReference$1;
/** @deprecated */
type AssetTransfer = AssetTransfer$1;
export type { AgentClient, AssetClientOwner, AssetReference, AssetTransfer, AssetUploadInput, AssetsClient, AutomationClient, BoardViewsClient, ClientOptions, CommandStreamClientEvent, DirectoryEntry, ExtensionClient, FilesystemClient, ListSessionsInput, NotificationsClient, ProjectClient, PstdioClient, RequestFn, RequestOptions, ResourceAnchorsClient, RuntimeClient, SessionClient, SessionStreamConnection, SessionStreamHandlers, SettingsClient, SkillClient, SseEvent, StartSyncInput, SyncClient, SyncConnection, SyncRow, SyncWriter, SyncWriterProvider, WorkspaceClient };
