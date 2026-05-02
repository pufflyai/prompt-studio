import { z } from "zod";

export const extensionDiagnosticSeveritySchema = z.enum(["info", "warning", "error"]);

export const extensionDiagnosticSchema = z.object({
  code: z.string(),
  severity: extensionDiagnosticSeveritySchema,
  message: z.string(),
  extensionId: z.string().optional(),
  commandId: z.string().optional(),
  sourcePath: z.string().optional(),
});

export const extensionRecordSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  displayName: z.string(),
  version: z.string().optional(),
  sourcePath: z.string(),
});

export const extensionCommandRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  namespace: z.string(),
  title: z.string(),
  description: z.string().optional(),
  cliPath: z.string().optional(),
});

export const extensionMiddlewareRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  commandId: z.string(),
});

export const extensionHookRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  eventId: z.string(),
});

export const extensionScheduleRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  cron: z.string(),
  commandId: z.string(),
});

export const extensionArtifactMountSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  namespace: z.string(),
  relativePath: z.string(),
  fullPath: z.string(),
  label: z.string(),
});

export const extensionViewLikeSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
});

export const extensionRouteRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  path: z.string(),
});

export const extensionNavigationRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  label: z.string(),
});

export const extensionsCheckResponseSchema = z.object({
  extensionsRoot: z.string(),
  extensionsRootExists: z.boolean(),
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  extensions: z.array(extensionRecordSchema),
  commands: z.array(extensionCommandRecordSchema),
  middlewares: z.array(extensionMiddlewareRecordSchema),
  hooks: z.array(extensionHookRecordSchema),
  schedules: z.array(extensionScheduleRecordSchema),
  artifactMounts: z.array(extensionArtifactMountSchema),
  views: z.array(extensionViewLikeSchema),
  routes: z.array(extensionRouteRecordSchema),
  navigation: z.array(extensionNavigationRecordSchema),
  templates: z.array(extensionViewLikeSchema),
  skills: z.array(extensionViewLikeSchema),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export type ExtensionDiagnostic = z.infer<typeof extensionDiagnosticSchema>;
export type ExtensionRecord = z.infer<typeof extensionRecordSchema>;
export type ExtensionCommandRecord = z.infer<typeof extensionCommandRecordSchema>;
export type ExtensionMiddlewareRecord = z.infer<typeof extensionMiddlewareRecordSchema>;
export type ExtensionHookRecord = z.infer<typeof extensionHookRecordSchema>;
export type ExtensionScheduleRecord = z.infer<typeof extensionScheduleRecordSchema>;
export type ExtensionArtifactMount = z.infer<typeof extensionArtifactMountSchema>;
export type ExtensionRouteRecord = z.infer<typeof extensionRouteRecordSchema>;
export type ExtensionNavigationRecord = z.infer<typeof extensionNavigationRecordSchema>;
export type ExtensionsCheckResponse = z.infer<typeof extensionsCheckResponseSchema>;

const jsonObjectSchema = z.record(z.string(), z.unknown());

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

export const commandSourceSchema = z.enum([
  "cli",
  "dashboard",
  "api",
  "schedule",
  "event",
  "automation",
  "command-panel",
]);

export const commandExecuteRequestSchema = z.object({
  projectId: z.string().min(1),
  params: jsonObjectSchema.optional(),
  resource: extensionResourceRefSchema.optional(),
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
export type CommandExecuteResponse = z.infer<typeof commandExecuteResponseSchema>;
