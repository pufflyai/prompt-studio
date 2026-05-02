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
