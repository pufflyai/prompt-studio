import { z } from "zod";
import {
  extensionPlacementSchema,
  extensionWhenExpressionSchema,
  jsonObjectSchema,
  localizableStringSchema,
} from "./common";
import { workbenchMenuTargetSchema } from "./targets";

export const extensionCommandRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  description: localizableStringSchema.optional(),
  cliPath: z.string().optional(),
  cliAliases: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  params: z.record(z.string(), z.object({ type: z.string() }).catchall(z.unknown())).optional(),
});

export const extensionParamObjectSchema = z.record(z.string(), z.object({ type: z.string() }).catchall(z.unknown()));

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

export const workbenchExtensionAutomationRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  extensionInstanceId: z.string().optional(),
  title: localizableStringSchema,
  cron: z.string(),
  commandId: z.string(),
  enabled: z.boolean(),
});

export const extensionMenuContributionSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  commandId: z.string(),
  slotId: z.string(),
  target: workbenchMenuTargetSchema.optional(),
  label: localizableStringSchema,
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  icon: z.string().optional(),
  presentation: z.enum(["menu-item", "button", "icon-button"]).optional(),
  params: jsonObjectSchema.optional(),
  when: extensionWhenExpressionSchema.optional(),
});

export const extensionCommandPaletteContributionSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  commandId: z.string(),
  label: localizableStringSchema,
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  icon: z.string().optional(),
  params: jsonObjectSchema.optional(),
  when: extensionWhenExpressionSchema.optional(),
});

export type ExtensionCommandRecord = z.infer<typeof extensionCommandRecordSchema>;
export type ExtensionMiddlewareRecord = z.infer<typeof extensionMiddlewareRecordSchema>;
export type ExtensionHookRecord = z.infer<typeof extensionHookRecordSchema>;
export type ExtensionScheduleRecord = z.infer<typeof extensionScheduleRecordSchema>;
export type WorkbenchExtensionAutomationRecord = z.infer<typeof workbenchExtensionAutomationRecordSchema>;
export type ExtensionMenuContribution = z.infer<typeof extensionMenuContributionSchema>;
export type ExtensionCommandPaletteContribution = z.infer<typeof extensionCommandPaletteContributionSchema>;
