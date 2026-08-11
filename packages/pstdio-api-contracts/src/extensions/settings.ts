import { z } from "zod";
import {
  extensionSettingScopeSchema,
  extensionSettingSourceSchema,
  extensionSettingValueTypeSchema,
  extensionWebviewContributionSchema,
  localizableStringSchema,
  workbenchExtensionWebviewSchema,
} from "./common";
import { workbenchSettingsScopeSchema, workbenchSettingsTargetSchema } from "./targets";

export const extensionSettingsPanelRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  extensionInstanceId: z.string().optional(),
  installedExtensionId: z.string().optional(),
  installName: z.string().optional(),
  slotId: z.string(),
  target: workbenchSettingsTargetSchema.optional(),
  scope: workbenchSettingsScopeSchema.optional(),
  title: localizableStringSchema,
  icon: z.string().optional(),
  section: z.string().optional(),
  webview: extensionWebviewContributionSchema,
});

export const extensionSettingDefinitionRecordSchema = z.object({
  key: z.string(),
  extensionId: z.string(),
  type: extensionSettingValueTypeSchema,
  scope: extensionSettingScopeSchema,
  default: z.unknown().optional(),
  enum: z.array(z.unknown()).optional(),
  title: localizableStringSchema.optional(),
  description: localizableStringSchema.optional(),
});

export const extensionSettingValueRecordSchema = extensionSettingDefinitionRecordSchema.extend({
  value: z.unknown().optional(),
  source: extensionSettingSourceSchema,
});

export const listExtensionSettingsResponseSchema = z.object({
  settings: z.array(extensionSettingValueRecordSchema),
});

export const updateExtensionSettingRequestSchema = z.object({
  value: z.unknown(),
});

export const workbenchExtensionSettingsPanelRecordSchema = extensionSettingsPanelRecordSchema.extend({
  webview: workbenchExtensionWebviewSchema,
});

export const extensionSettingsSectionRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  scope: workbenchSettingsScopeSchema.optional(),
  order: z.number().optional(),
});

export type ExtensionSettingsPanelRecord = z.infer<typeof extensionSettingsPanelRecordSchema>;
export type ExtensionSettingDefinitionRecord = z.infer<typeof extensionSettingDefinitionRecordSchema>;
export type ExtensionSettingValueRecord = z.infer<typeof extensionSettingValueRecordSchema>;
export type ListExtensionSettingsResponse = z.infer<typeof listExtensionSettingsResponseSchema>;
export type UpdateExtensionSettingRequest = z.infer<typeof updateExtensionSettingRequestSchema>;
export type WorkbenchExtensionSettingsPanelRecord = z.infer<typeof workbenchExtensionSettingsPanelRecordSchema>;
export type ExtensionSettingsSectionRecord = z.infer<typeof extensionSettingsSectionRecordSchema>;
