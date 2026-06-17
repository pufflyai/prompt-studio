import { z } from "zod";
import { commandSourceSchema, extensionSlotKindSchema, jsonObjectSchema } from "./common";
import { workbenchAttachmentTargetSchema } from "./targets";

export const extensionResourceRefSchema = z.object({
  type: z.string(),
  id: z.string(),
  projectId: z.string().optional(),
  label: z.string().optional(),
  extensionId: z.string().optional(),
  metadata: jsonObjectSchema.optional(),
});

export const extensionRepoContextSchema = z.object({
  projectId: z.string(),
  repoId: z.string(),
  path: z.string(),
  remote: z.string().nullable().optional(),
  role: z.enum(["default", "selected", "workspace"]).optional(),
});

export const extensionSlotInvocationSchema = z.object({
  id: z.string(),
  kind: extensionSlotKindSchema,
  context: jsonObjectSchema,
});

export const extensionAttachmentInvocationSchema = z.object({
  target: workbenchAttachmentTargetSchema,
  mode: z.string().optional(),
  projectId: z.string().optional(),
  resource: extensionResourceRefSchema.optional(),
});

export const commandExecuteRequestSchema = z.object({
  projectId: z.string().min(1),
  params: jsonObjectSchema.optional(),
  resource: extensionResourceRefSchema.optional(),
  attachment: extensionAttachmentInvocationSchema.optional(),
  slot: extensionSlotInvocationSchema.optional(),
  repo: extensionRepoContextSchema.optional(),
  source: commandSourceSchema.optional(),
  metadata: jsonObjectSchema.optional(),
});

export const commandExecuteBodySchema = z.object({
  params: jsonObjectSchema.optional(),
  resource: extensionResourceRefSchema.optional(),
  attachment: extensionAttachmentInvocationSchema.optional(),
  slot: extensionSlotInvocationSchema.optional(),
  repo: extensionRepoContextSchema.optional(),
  source: commandSourceSchema.optional(),
  metadata: jsonObjectSchema.optional(),
});

const serializedErrorSchema = z.object({
  name: z.string().optional(),
  message: z.string(),
  stack: z.string().optional(),
});

const commandNoticeSchema = z.object({
  type: z.enum(["info", "success", "warning", "error"]),
  title: z.string().optional(),
  message: z.string(),
  metadata: jsonObjectSchema.optional(),
});

const commandDiagnosticSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  extensionId: z.string().optional(),
  commandId: z.string().optional(),
  metadata: jsonObjectSchema.optional(),
});

export const commandOutcomeSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["success", "rejected", "error"]),
  value: z.unknown().optional(),
  code: z.string().optional(),
  reason: z.string().optional(),
  data: jsonObjectSchema.optional(),
  error: serializedErrorSchema.optional(),
  notices: z.array(commandNoticeSchema).optional(),
  diagnostics: z.array(commandDiagnosticSchema).optional(),
});

export const commandExecuteResponseSchema = z.object({
  commandId: z.string(),
  extensionId: z.string(),
  outcome: commandOutcomeSchema,
});

export type CommandExecuteRequest = z.infer<typeof commandExecuteRequestSchema>;
export type CommandExecuteBody = z.infer<typeof commandExecuteBodySchema>;
export type CommandExecuteResponse = z.infer<typeof commandExecuteResponseSchema>;
