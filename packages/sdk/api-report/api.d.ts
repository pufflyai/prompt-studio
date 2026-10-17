import { z } from "zod";
type ViewFilterCondition = "contains" | "does-not-contain" | "is" | "is-not" | "gt" | "gte" | "lt" | "lte" | "is-before" | "is-after" | "is-on-or-before" | "is-on-or-after" | "is-any-of" | "is-none-of" | "has-any-of" | "has-all-of" | "has-none-of" | "is-empty" | "is-not-empty";
type ViewFilterRule = {
  attributeId: string;
  condition: ViewFilterCondition;
  value?: boolean | string | number | string[];
};
type ViewFilterGroup = {
  conjunction: "and" | "or";
  rules: ViewFilterRule[];
  groups?: {
    conjunction: "and" | "or";
    rules: ViewFilterRule[];
  }[];
};
type ViewFieldKind = "string" | "number" | "boolean" | "date" | "enum" | "status" | "enum-multi" | "user";
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
interface TerminalSessionRequest {
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols: number;
  rows: number;
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
type TerminalHostEvent = {
  sessionId: string;
  kind: "data";
  chunk: Uint8Array;
} | {
  sessionId: string;
  kind: "exit";
  code: number | null;
  signal: string | null;
};
interface TerminalSessionExit {
  code: number | null;
  signal: string | null;
}
interface TerminalSessionError {
  message: string;
}
interface TerminalSessionAdapter {
  readonly id: string;
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): Promise<void> | void;
  onData(handler: (chunk: Uint8Array) => void): () => void;
  onTitle?(handler: (title: string) => void): () => void;
  onExit(handler: (exit: TerminalSessionExit) => void): () => void;
  onError(handler: (error: TerminalSessionError) => void): () => void;
}
interface TerminalBridge {
  openSession(request: TerminalSessionRequest): Promise<TerminalSessionAdapter>;
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
type QueuedFollowUpRequest = z.infer<typeof queuedFollowUpSchema>;
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
declare const sessionAttachmentRefSchema: z.ZodObject<{
  file_id: z.ZodString;
}, z.core.$strip>;
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
type ResolveSessionIdInput = z.infer<typeof resolveSessionIdInputSchema>;
type ResolveSessionIdResponse = z.infer<typeof resolveSessionIdResponseSchema>;
type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
type FollowUpInput = z.infer<typeof followUpInputSchema>;
type SessionAttachment = z.infer<typeof sessionAttachmentSchema>;
type SessionAttachmentRef = z.infer<typeof sessionAttachmentRefSchema>;
type ApprovalInput = z.infer<typeof approvalInputSchema>;
type SessionConversationResponse = z.infer<typeof sessionConversationResponseSchema>;
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
type NotificationKind$1 = "needs_review" | "ready_to_merge" | "blocked" | "approval_required" | "failed" | "info";
type NotificationStatus$1 = "open" | "read" | "snoozed" | "done" | "dismissed" | "expired";
type NotificationPriority$1 = "low" | "normal" | "high" | "urgent";
type NotificationActorType$1 = "user" | "agent" | "system";
type NotificationOrigin$1 = "core" | "extension" | "agent";
type NotificationAction$1 = {
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
interface Notification$1 {
  id: string;
  projectId: string;
  title: string;
  body?: string | null;
  kind: NotificationKind$1;
  status: NotificationStatus$1;
  priority: NotificationPriority$1;
  source: CommandSource;
  origin: NotificationOrigin$1;
  sourceExtensionId?: string | null;
  actorType?: NotificationActorType$1 | null;
  actorId?: string | null;
  target?: ResourceRef | null;
  related: ResourceRef[];
  actions: NotificationAction$1[];
  dedupeKey?: string | null;
  metadata?: JsonObject | null;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null;
  resolvedAt?: string | null;
  snoozedUntil?: string | null;
  expiresAt?: string | null;
}
interface CreateNotificationInput$1 {
  projectId: string;
  title: string;
  body?: string;
  kind: NotificationKind$1;
  priority?: NotificationPriority$1;
  target?: ResourceRef;
  related?: ResourceRef[];
  actions?: NotificationAction$1[];
  dedupeKey?: string;
  expiresAt?: string;
  snoozedUntil?: string;
  metadata?: JsonObject;
}
interface UpdateNotificationInput$1 {
  priority?: NotificationPriority$1;
  snoozedUntil?: string | null;
  metadata?: JsonObject;
}
interface ListNotificationsQuery$1 {
  status?: NotificationStatus$1 | NotificationStatus$1[];
  priority?: NotificationPriority$1 | NotificationPriority$1[];
  sourceExtensionId?: string;
  resourceType?: string;
  resourceId?: string;
  cursor?: string;
  limit?: number;
}
interface ListNotificationsResponse$1 {
  items: Notification$1[];
  nextCursor?: string | null;
}
declare const updateSkillInputSchema: z.ZodObject<{
  enabled: z.ZodOptional<z.ZodBoolean>;
  title: z.ZodOptional<z.ZodString>;
  description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type UpdateSkillInput = z.infer<typeof updateSkillInputSchema>;
declare const boardFieldSchema: z.ZodObject<{
  id: z.ZodString;
  label: z.ZodString;
  kind: z.ZodEnum<{
    boolean: "boolean";
    date: "date";
    enum: "enum";
    "enum-multi": "enum-multi";
    number: "number";
    status: "status";
    string: "string";
    user: "user";
  }>;
  conditions: z.ZodArray<z.ZodEnum<{
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
  }>>;
  filterable: z.ZodBoolean;
  groupable: z.ZodBoolean;
  sortable: z.ZodBoolean;
  displayable: z.ZodBoolean;
  legacyValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
  options: z.ZodOptional<z.ZodArray<z.ZodObject<{
    value: z.ZodString;
    label: z.ZodString;
  }, z.core.$strip>>>;
}, z.core.$strip>;
declare const boardSummarySchema: z.ZodObject<{
  id: z.ZodString;
  title: z.ZodString;
  kind: z.ZodEnum<{
    dataTable: "dataTable";
    kanban: "kanban";
  }>;
  extensionId: z.ZodNullable<z.ZodString>;
  fields: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    kind: z.ZodEnum<{
      boolean: "boolean";
      date: "date";
      enum: "enum";
      "enum-multi": "enum-multi";
      number: "number";
      status: "status";
      string: "string";
      user: "user";
    }>;
    conditions: z.ZodArray<z.ZodEnum<{
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
    }>>;
    filterable: z.ZodBoolean;
    groupable: z.ZodBoolean;
    sortable: z.ZodBoolean;
    displayable: z.ZodBoolean;
    legacyValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
      value: z.ZodString;
      label: z.ZodString;
    }, z.core.$strip>>>;
  }, z.core.$strip>>;
}, z.core.$strip>;
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
type BoardSummary = z.infer<typeof boardSummarySchema>;
type BoardField = z.infer<typeof boardFieldSchema>;
type BoardView = z.infer<typeof boardViewSchema>;
type BoardViews = z.infer<typeof boardViewsSchema>;
type BoardViewCreate = z.infer<typeof boardViewCreateSchema>;
type BoardViewUpdate = z.infer<typeof boardViewUpdateSchema>;
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
declare const automationRunStatusSchema: z.ZodEnum<{
  cancelled: "cancelled";
  failed: "failed";
  queued: "queued";
  rejected: "rejected";
  running: "running";
  succeeded: "succeeded";
}>;
declare const issueAutomationTokenInputSchema: z.ZodObject<{
  name: z.ZodString;
  projectId: z.ZodString;
  principalId: z.ZodOptional<z.ZodString>;
  commandScopes: z.ZodArray<z.ZodString>;
  expiresInSeconds: z.ZodNumber;
}, z.core.$strict>;
declare const automationTokenRecordSchema: z.ZodObject<{
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
}, z.core.$strip>;
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
declare const automationRunErrorSchema: z.ZodObject<{
  code: z.ZodString;
  message: z.ZodString;
  retryable: z.ZodBoolean;
}, z.core.$strip>;
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
declare const automationRunEventSchema: z.ZodObject<{
  cursor: z.ZodNumber;
  runId: z.ZodString;
  type: z.ZodString;
  payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  createdAt: z.ZodString;
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
type AutomationRunStatus = z.infer<typeof automationRunStatusSchema>;
type IssueAutomationTokenInput = z.infer<typeof issueAutomationTokenInputSchema>;
type AutomationTokenRecord = z.infer<typeof automationTokenRecordSchema>;
type IssueAutomationTokenResponse = z.infer<typeof issueAutomationTokenResponseSchema>;
type ListAutomationTokensResponse = z.infer<typeof listAutomationTokensResponseSchema>;
type CreateAutomationRunInput = z.infer<typeof createAutomationRunInputSchema>;
type AutomationRunError = z.infer<typeof automationRunErrorSchema>;
type AutomationRun = z.infer<typeof automationRunSchema>;
type AutomationRunEvent = z.infer<typeof automationRunEventSchema>;
type ListAutomationRunEventsResponse = z.infer<typeof listAutomationRunEventsResponseSchema>;
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
declare const workbenchExtensionViewBodySchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
declare const workbenchExtensionViewRecordSchema: z.ZodObject<{
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
}, z.core.$strip>;
declare const workbenchExtensionMetadataSchema: z.ZodObject<{
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
  automations: z.ZodOptional<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    localId: z.ZodString;
    extensionId: z.ZodString;
    extensionInstanceId: z.ZodOptional<z.ZodString>;
    title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    cron: z.ZodString;
    commandId: z.ZodString;
    enabled: z.ZodBoolean;
  }, z.core.$strip>>>;
  connections: z.ZodOptional<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    localId: z.ZodString;
    extensionId: z.ZodString;
    label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    authType: z.ZodEnum<{
      bearer: "bearer";
      header: "header";
    }>;
    supportsCheck: z.ZodBoolean;
  }, z.core.$strip>>>;
  harnesses: z.ZodOptional<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    localId: z.ZodString;
    extensionId: z.ZodString;
    label: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
  }, z.core.$strip>>>;
  skills: z.ZodOptional<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    localId: z.ZodString;
    extensionId: z.ZodString;
    title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
  }, z.core.$strip>>>;
  templates: z.ZodOptional<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    localId: z.ZodString;
    extensionId: z.ZodString;
    title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
  }, z.core.$strip>>>;
  templateTypes: z.ZodOptional<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    localId: z.ZodString;
    extensionId: z.ZodString;
    label: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    description: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
      $l10n: z.ZodString;
      default: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>;
    order: z.ZodOptional<z.ZodNumber>;
    commands: z.ZodOptional<z.ZodObject<{
      list: z.ZodString;
      read: z.ZodString;
      save: z.ZodString;
      delete: z.ZodString;
    }, z.core.$strip>>;
  }, z.core.$strip>>>;
  themes: z.ZodOptional<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    localId: z.ZodString;
    extensionId: z.ZodString;
    title: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
}, z.core.$strip>;
type WorkbenchExtensionMetadata = z.infer<typeof workbenchExtensionMetadataSchema>;
type WorkbenchExtensionViewRecord = z.infer<typeof workbenchExtensionViewRecordSchema>;
type WorkbenchExtensionViewBody = z.infer<typeof workbenchExtensionViewBodySchema>;
type WorkbenchExtensionHarnessRecord = NonNullable<WorkbenchExtensionMetadata["harnesses"]>[number];
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
export declare const viewFilterValueKind: (kind: ViewFieldKind, condition: ViewFilterCondition) => "boolean" | "day" | "none" | "number" | "options" | "text";
interface ViewRuleField {
  id: string;
  kind: ViewFieldKind;
  filterable: boolean;
  sortable: boolean;
  options?: {
    value: string;
  }[];
}
export declare const findViewFilterProblem: (filter: ViewFilterGroup, fields: ViewRuleField[]) => string | undefined;
declare const extensionCommandRecordSchema: z.ZodObject<{
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
}, z.core.$strip>;
declare const workbenchExtensionAutomationRecordSchema: z.ZodObject<{
  id: z.ZodString;
  localId: z.ZodString;
  extensionId: z.ZodString;
  extensionInstanceId: z.ZodOptional<z.ZodString>;
  title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    $l10n: z.ZodString;
    default: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>]>;
  cron: z.ZodString;
  commandId: z.ZodString;
  enabled: z.ZodBoolean;
}, z.core.$strip>;
declare const extensionMenuContributionSchema: z.ZodObject<{
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
}, z.core.$strip>;
declare const extensionCommandPaletteContributionSchema: z.ZodObject<{
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
}, z.core.$strip>;
type ExtensionCommandRecord = z.infer<typeof extensionCommandRecordSchema>;
type WorkbenchExtensionAutomationRecord = z.infer<typeof workbenchExtensionAutomationRecordSchema>;
type ExtensionMenuContribution = z.infer<typeof extensionMenuContributionSchema>;
type ExtensionCommandPaletteContribution = z.infer<typeof extensionCommandPaletteContributionSchema>;
declare const localizableStringSchema: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
  $l10n: z.ZodString;
  default: z.ZodOptional<z.ZodString>;
}, z.core.$strip>]>;
declare const extensionDiagnosticSchema: z.ZodObject<{
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
}, z.core.$strip>;
declare const extensionRecordSchema: z.ZodObject<{
  id: z.ZodString;
  name: z.ZodString;
  displayName: z.ZodString;
  extensionInstanceId: z.ZodOptional<z.ZodString>;
  installedExtensionId: z.ZodOptional<z.ZodString>;
  installName: z.ZodOptional<z.ZodString>;
  version: z.ZodOptional<z.ZodString>;
  description: z.ZodOptional<z.ZodString>;
  sourcePath: z.ZodString;
}, z.core.$strip>;
type ExtensionDiagnostic = z.infer<typeof extensionDiagnosticSchema>;
type LocalizableString = z.infer<typeof localizableStringSchema>;
type ExtensionRecord = z.infer<typeof extensionRecordSchema>;
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
declare const projectExtensionInstanceSchema: z.ZodObject<{
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
declare const marketplaceExtensionSchema: z.ZodObject<{
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
declare const installMarketplaceExtensionResponseSchema: z.ZodObject<{
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
declare const addLocalExtensionFolderResponseSchema: z.ZodObject<{
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
type ProjectExtensionInstance = z.infer<typeof projectExtensionInstanceSchema>;
type MarketplaceExtension = z.infer<typeof marketplaceExtensionSchema>;
type ListProjectExtensionsResponse = z.infer<typeof listProjectExtensionsResponseSchema>;
type UpgradeProjectExtensionResponse = z.infer<typeof upgradeProjectExtensionResponseSchema>;
type InstallMarketplaceExtensionResponse = z.infer<typeof installMarketplaceExtensionResponseSchema>;
type AddLocalExtensionFolderResponse = z.infer<typeof addLocalExtensionFolderResponseSchema>;
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
declare const installedExtensionSourceSchema: z.ZodObject<{
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
type InstalledExtensionSource = z.infer<typeof installedExtensionSourceSchema>;
type ExtensionDiagnosticsResponse = z.infer<typeof extensionDiagnosticsResponseSchema>;
declare const extensionCommandPaletteResourceRecordSchema: z.ZodObject<{
  id: z.ZodString;
  extensionId: z.ZodString;
  title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    $l10n: z.ZodString;
    default: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>]>;
  resourceKind: z.ZodOptional<z.ZodString>;
  queryHandlerId: z.ZodString;
  refreshEventIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
type ExtensionCommandPaletteResourceRecord = z.infer<typeof extensionCommandPaletteResourceRecordSchema>;
type WorkbenchExtensionCommandPaletteResourceRecord = z.infer<typeof extensionCommandPaletteResourceRecordSchema>;
declare const extensionKeybindingRecordSchema: z.ZodObject<{
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
}, z.core.$strip>;
type ExtensionKeybindingRecord = z.infer<typeof extensionKeybindingRecordSchema>;
declare const extensionSettingsPanelRecordSchema: z.ZodObject<{
  id: z.ZodString;
  extensionId: z.ZodString;
  extensionInstanceId: z.ZodOptional<z.ZodString>;
  installedExtensionId: z.ZodOptional<z.ZodString>;
  installName: z.ZodOptional<z.ZodString>;
  slotId: z.ZodString;
  target: z.ZodOptional<z.ZodEnum<{
    "workbench.settings": "workbench.settings";
  }>>;
  scope: z.ZodOptional<z.ZodEnum<{
    global: "global";
    project: "project";
  }>>;
  title: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    $l10n: z.ZodString;
    default: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>]>;
  icon: z.ZodOptional<z.ZodString>;
  section: z.ZodOptional<z.ZodString>;
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
  }, z.core.$strip>;
}, z.core.$strip>;
declare const extensionSettingDefinitionRecordSchema: z.ZodObject<{
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
}, z.core.$strip>;
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
declare const listExtensionSettingsResponseSchema: z.ZodObject<{
  settings: z.ZodArray<z.ZodObject<{
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
  }, z.core.$strip>>;
}, z.core.$strip>;
declare const updateExtensionSettingRequestSchema: z.ZodObject<{
  value: z.ZodUnknown;
}, z.core.$strip>;
type ExtensionSettingsPanelRecord = z.infer<typeof extensionSettingsPanelRecordSchema>;
type ExtensionSettingDefinitionRecord = z.infer<typeof extensionSettingDefinitionRecordSchema>;
type ExtensionSettingValueRecord = z.infer<typeof extensionSettingValueRecordSchema>;
type ListExtensionSettingsResponse = z.infer<typeof listExtensionSettingsResponseSchema>;
type UpdateExtensionSettingRequest = z.infer<typeof updateExtensionSettingRequestSchema>;
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
type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
export declare const sessionAttachmentMimeTypesByExtension: {
  readonly c: "text/plain";
  readonly cc: "text/plain";
  readonly cpp: "text/plain";
  readonly cs: "text/plain";
  readonly css: "text/css";
  readonly csv: "text/csv";
  readonly cxx: "text/plain";
  readonly go: "text/plain";
  readonly h: "text/plain";
  readonly hpp: "text/plain";
  readonly html: "text/html";
  readonly java: "text/plain";
  readonly js: "application/javascript";
  readonly jsx: "text/plain";
  readonly json: "application/json";
  readonly jsonc: "application/json";
  readonly kt: "text/plain";
  readonly kts: "text/plain";
  readonly lua: "text/plain";
  readonly markdown: "text/markdown";
  readonly md: "text/markdown";
  readonly mjs: "application/javascript";
  readonly pdf: "application/pdf";
  readonly php: "text/plain";
  readonly png: "image/png";
  readonly py: "text/plain";
  readonly rb: "text/plain";
  readonly rs: "text/plain";
  readonly sh: "text/plain";
  readonly sql: "text/plain";
  readonly svg: "image/svg+xml";
  readonly swift: "text/plain";
  readonly toml: "text/plain";
  readonly ts: "text/plain";
  readonly tsx: "text/plain";
  readonly txt: "text/plain";
  readonly vue: "text/plain";
  readonly xml: "text/xml";
  readonly xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  readonly yaml: "text/plain";
  readonly yml: "text/plain";
};
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
type CreateWorkspaceInput$1 = z.infer<typeof createWorkspaceInputSchema>;
type RenameWorkspaceInput$1 = z.infer<typeof renameWorkspaceInputSchema>;
type RemoveWorktreeResponse$1 = z.infer<typeof removeWorktreeResponseSchema>;
type WorkspaceFileEntry$1 = z.infer<typeof workspaceFileEntrySchema>;
type WorkspaceFilesResponse$1 = z.infer<typeof workspaceFilesResponseSchema>;
type WorkspaceFileContent$1 = z.infer<typeof workspaceFileContentSchema>;
type WriteWorkspaceFileInput$1 = z.infer<typeof writeWorkspaceFileInputSchema>;
type ListWorkspaceFilesInput$1 = z.infer<typeof listWorkspaceFilesInputSchema>;
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
/** @deprecated */
type CreateNotificationInput = CreateNotificationInput$1;
/** @deprecated */
type ListNotificationsQuery = ListNotificationsQuery$1;
/** @deprecated */
type ListNotificationsResponse = ListNotificationsResponse$1;
/** @deprecated */
type Notification = Notification$1;
/** @deprecated */
type NotificationAction = NotificationAction$1;
/** @deprecated */
type NotificationActorType = NotificationActorType$1;
/** @deprecated */
type NotificationKind = NotificationKind$1;
/** @deprecated */
type NotificationOrigin = NotificationOrigin$1;
/** @deprecated */
type NotificationPriority = NotificationPriority$1;
/** @deprecated */
type NotificationStatus = NotificationStatus$1;
/** @deprecated */
type UpdateNotificationInput = UpdateNotificationInput$1;
type CreateWorkspaceInput = CreateWorkspaceInput$1;
type RemoveWorktreeResponse = RemoveWorktreeResponse$1;
type RenameWorkspaceInput = RenameWorkspaceInput$1;
type ListWorkspaceFilesInput = ListWorkspaceFilesInput$1;
type WorkspaceFileContent = WorkspaceFileContent$1;
type WorkspaceFileEntry = WorkspaceFileEntry$1;
type WorkspaceFilesResponse = WorkspaceFilesResponse$1;
type WriteWorkspaceFileInput = WriteWorkspaceFileInput$1;
export type { AddLocalExtensionFolderResponse, ApprovalInput, AutomationRun, AutomationRunError, AutomationRunEvent, AutomationRunStatus, AutomationTokenRecord, BoardField, BoardSummary, BoardView, BoardViewCreate, BoardViewUpdate, BoardViews, CombineQueuedFollowUpsInput, CommandExecuteRequest, CommandExecuteResponse, ConfigureExtensionConnectionInput, CreateAutomationRunInput, CreateNotificationInput, CreateProjectInput, CreateSessionInput, CreateWorkspaceInput, ExtensionCommandPaletteContribution, ExtensionCommandPaletteResourceRecord, ExtensionCommandRecord, ExtensionConnectionRecord, ExtensionDiagnostic, ExtensionDiagnosticsResponse, ExtensionKeybindingRecord, ExtensionMenuContribution, ExtensionRecord, ExtensionSettingDefinitionRecord, ExtensionSettingValueRecord, ExtensionSettingsPanelRecord, FollowUpInput, InstallExtensionRequest, InstallExtensionResponse, InstallMarketplaceExtensionResponse, InstalledExtensionSource, IssueAutomationTokenInput, IssueAutomationTokenResponse, ListAutomationRunEventsResponse, ListAutomationTokensResponse, ListExtensionAppearanceResponse, ListExtensionCommandsResponse, ListExtensionConnectionsResponse, ListExtensionSettingsResponse, ListNotificationsQuery, ListNotificationsResponse, ListProjectExtensionsResponse, ListWorkspaceFilesInput, LocalizableString, MarketplaceExtension, Notification, NotificationAction, NotificationActorType, NotificationKind, NotificationOrigin, NotificationPriority, NotificationStatus, PendingQueuedFollowUpsResponse, ProjectExtensionInstance, QueuedFollowUpRequest, QueuedFollowUpUpdateResponse, QueuedSteeringResult, RemoveWorktreeResponse, RenameWorkspaceInput, ResolveSessionIdInput, ResolveSessionIdResponse, ResourceRef, SessionAttachment, SessionAttachmentRef, SessionConversationResponse, SessionConversationSources, SessionQueuedMessagesResponse, Settings, SteerQueuedFollowUpInput, TerminalBridge, TerminalHostEvent, TerminalSessionAdapter, TerminalSessionError, TerminalSessionExit, TerminalSessionOperation, TerminalSessionRequest, TerminalSessionResult, UpdateExtensionSettingRequest, UpdateNotificationInput, UpdateProjectInput, UpdateQueuedFollowUpInput, UpdateSettingsInput, UpdateSkillInput, UpgradeProjectExtensionResponse, WorkbenchExtensionAutomationRecord, WorkbenchExtensionCommandPaletteResourceRecord, WorkbenchExtensionHarnessRecord, WorkbenchExtensionMetadata, WorkbenchExtensionViewBody, WorkbenchExtensionViewRecord, WorkspaceFileContent, WorkspaceFileEntry, WorkspaceFilesResponse, WorkspaceProviderDescriptor, WriteWorkspaceFileInput };
