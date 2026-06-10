import { z } from "zod";

export type SessionMessageRole = "user" | "assistant" | "tool" | "system" | "developer";

export type TextPart = { type: "text"; text: string };

export type ReasoningPart = { type: "reasoning"; text: string };

export type ToolPartActionType = "read" | "write" | "execute" | "network" | "other";

export type ToolPartStatus = "pending" | "running" | "completed" | "failed" | "denied";

export type ToolPart = {
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

export type StepStartPart = { type: "step-start"; snapshot?: string };

export type StepFinishPart = {
  type: "step-finish";
  reason?: string;
  snapshot?: string;
  cost?: number;
  tokens?: unknown;
};

export type PatchPart = { type: "patch"; hash?: string; files?: unknown };

export type FilePart = { type: "file"; mediaType?: string; filename?: string; url: string };

export type LoadingPart = { type: "loading" };

export type ErrorPart = {
  type: "error";
  errorType: "timeout" | "crash" | "permission" | "other";
  message?: string;
};

export type TokenUsagePart = {
  type: "token_usage";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export type SessionMessagePart =
  | TextPart
  | ReasoningPart
  | ToolPart
  | StepStartPart
  | StepFinishPart
  | PatchPart
  | FilePart
  | LoadingPart
  | ErrorPart
  | TokenUsagePart;

export type SessionMessage = {
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
    cache?: { read?: number; write?: number };
  };
};

const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const reasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
});

const toolPartActionTypeSchema = z.enum(["read", "write", "execute", "network", "other"]);

const toolPartStatusSchema = z.enum(["pending", "running", "completed", "failed", "denied"]);

const toolPartSchema = z.object({
  type: z.literal("tool"),
  tool: z.string(),
  callId: z.string().optional(),
  actionType: toolPartActionTypeSchema.optional(),
  status: toolPartStatusSchema.optional(),
  state: z
    .object({
      status: z.string().optional(),
      input: z.unknown().optional(),
      output: z.unknown().optional(),
      errorText: z.string().optional(),
      metadata: z.unknown().optional(),
    })
    .optional(),
});

const stepStartPartSchema = z.object({
  type: z.literal("step-start"),
  snapshot: z.string().optional(),
});

const stepFinishPartSchema = z.object({
  type: z.literal("step-finish"),
  reason: z.string().optional(),
  snapshot: z.string().optional(),
  cost: z.number().optional(),
  tokens: z.unknown().optional(),
});

const patchPartSchema = z.object({
  type: z.literal("patch"),
  hash: z.string().optional(),
  files: z.unknown().optional(),
});

const filePartSchema = z.object({
  type: z.literal("file"),
  mediaType: z.string().optional(),
  filename: z.string().optional(),
  url: z.string(),
});

const loadingPartSchema = z.object({
  type: z.literal("loading"),
});

const errorPartSchema = z.object({
  type: z.literal("error"),
  errorType: z.enum(["timeout", "crash", "permission", "other"]),
  message: z.string().optional(),
});

const tokenUsagePartSchema = z.object({
  type: z.literal("token_usage"),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number().optional(),
  cacheWriteTokens: z.number().optional(),
});

export const sessionMessagePartSchema = z.union([
  textPartSchema,
  reasoningPartSchema,
  toolPartSchema,
  stepStartPartSchema,
  stepFinishPartSchema,
  patchPartSchema,
  filePartSchema,
  loadingPartSchema,
  errorPartSchema,
  tokenUsagePartSchema,
]);

export const sessionMessageRoleSchema = z.enum(["user", "assistant", "tool", "system", "developer"]);

export const sessionMessageSchema = z.object({
  id: z.string(),
  role: sessionMessageRoleSchema,
  parts: z.array(sessionMessagePartSchema),
  index: z.number().optional(),
  createdAt: z.number().optional(),
  modelId: z.string().optional(),
  providerId: z.string().optional(),
  tokens: z
    .object({
      input: z.number().optional(),
      output: z.number().optional(),
      reasoning: z.number().optional(),
      cache: z
        .object({
          read: z.number().optional(),
          write: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});
