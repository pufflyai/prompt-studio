import { z } from "zod";

export const jsonObjectSchema = z.record(z.string(), z.unknown());
export const localizedStringSchema = z.object({ $l10n: z.string(), default: z.string().optional() });
export const localizableStringSchema = z.union([z.string(), localizedStringSchema]);

export const extensionSettingScopeSchema = z.enum(["global", "project"]);
export const extensionSettingValueTypeSchema = z.enum(["boolean", "number", "string", "array", "object"]);
export const extensionSettingSourceSchema = z.enum(["stored", "default"]);

export const extensionDiagnosticSeveritySchema = z.enum(["info", "warning", "error"]);

export const extensionDiagnosticSchema = z.object({
  code: z.string(),
  severity: extensionDiagnosticSeveritySchema,
  message: z.string(),
  extensionId: z.string().optional(),
  commandId: z.string().optional(),
  sourcePath: z.string().optional(),
  metadata: jsonObjectSchema.optional(),
});

export const extensionRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  sourcePath: z.string(),
});

export const packageAssetDescriptorSchema = z.object({
  kind: z.literal("package-asset"),
  path: z.string(),
  baseUrl: z.string(),
});

export const extensionPlacementSchema = z.enum(["first", "default", "last"]);
export const extensionSlotKindSchema = z.enum([
  "menu",
  "panel",
  "settings",
  "renderer",
  "kanbanRenderer",
  "dataTableRenderer",
]);

export const commandSourceSchema = z.enum([
  "cli",
  "dashboard",
  "api",
  "schedule",
  "event",
  "automation",
  "command-panel",
]);

export const extensionWhenExpressionSchema = z.object({
  mode: z.union([z.string(), z.array(z.string())]).optional(),
  source: z.array(commandSourceSchema).optional(),
  resourceType: z.array(z.string()).optional(),
  metadata: jsonObjectSchema.optional(),
});

export const extensionWebviewContributionSchema = z.object({
  entry: packageAssetDescriptorSchema,
  title: localizableStringSchema.optional(),
  /** Host capabilities the webview is allowed to invoke through the bridge. */
  capabilities: z.array(z.string()).optional(),
});

export const workbenchExtensionWebviewSchema = extensionWebviewContributionSchema.extend({
  /** API-served URL of the bridge runtime HTML the dashboard mounts in the iframe. */
  runtimeUrl: z.string(),
  /** API-served URL of the bundled extension module the bridge runtime dynamically imports. */
  moduleUrl: z.string(),
  /** API-served URLs of CSS files the bridge runtime should inject before mounting the module. */
  styles: z.array(z.string()).optional(),
});

export type ExtensionDiagnostic = z.infer<typeof extensionDiagnosticSchema>;
export type LocalizableString = z.infer<typeof localizableStringSchema>;
export type ExtensionRecord = z.infer<typeof extensionRecordSchema>;
