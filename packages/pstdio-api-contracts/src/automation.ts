import { z } from "zod";
import { extensionResourceRefSchema } from "./extensions";
import { jsonObjectSchema } from "./extensions/common";

export const automationRunStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled", "rejected"]);

export const issueAutomationTokenInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    projectId: z.string().min(1),
    principalId: z.string().uuid().optional(),
    commandScopes: z.array(z.string().min(1)).min(1),
    expiresInSeconds: z
      .number()
      .int()
      .positive()
      .max(365 * 24 * 60 * 60),
  })
  .strict();

export const automationTokenRecordSchema = z.object({
  id: z.string(),
  principalId: z.string(),
  name: z.string(),
  tokenPrefix: z.string(),
  projectId: z.string(),
  commandScopes: z.array(z.string()),
  expiresAt: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const issueAutomationTokenResponseSchema = automationTokenRecordSchema.extend({ token: z.string() });
export const listAutomationTokensResponseSchema = z.object({ tokens: z.array(automationTokenRecordSchema) });

export const createAutomationRunInputSchema = z
  .object({
    commandId: z.string().min(1),
    input: z
      .object({
        workspaceId: z.string().optional(),
        params: jsonObjectSchema.optional(),
        resource: extensionResourceRefSchema.optional(),
        metadata: jsonObjectSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const automationRunErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});

export const automationRunSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  commandId: z.string(),
  status: automationRunStatusSchema,
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  result: z.unknown().nullable(),
  error: automationRunErrorSchema.nullable(),
});

export const automationRunEventSchema = z.object({
  cursor: z.number().int().nonnegative(),
  runId: z.string(),
  type: z.string(),
  payload: jsonObjectSchema,
  createdAt: z.string(),
});

export const listAutomationRunEventsResponseSchema = z.object({ events: z.array(automationRunEventSchema) });

export type AutomationRunStatus = z.infer<typeof automationRunStatusSchema>;
export type IssueAutomationTokenInput = z.infer<typeof issueAutomationTokenInputSchema>;
export type AutomationTokenRecord = z.infer<typeof automationTokenRecordSchema>;
export type IssueAutomationTokenResponse = z.infer<typeof issueAutomationTokenResponseSchema>;
export type ListAutomationTokensResponse = z.infer<typeof listAutomationTokensResponseSchema>;
export type CreateAutomationRunInput = z.infer<typeof createAutomationRunInputSchema>;
export type AutomationRunError = z.infer<typeof automationRunErrorSchema>;
export type AutomationRun = z.infer<typeof automationRunSchema>;
export type AutomationRunEvent = z.infer<typeof automationRunEventSchema>;
export type ListAutomationRunEventsResponse = z.infer<typeof listAutomationRunEventsResponseSchema>;
