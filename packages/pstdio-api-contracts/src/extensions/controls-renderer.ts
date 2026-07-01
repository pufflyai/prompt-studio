import { z } from "zod";
import { localizableStringSchema } from "./common";

const controlsRendererLayoutSchema = z.object({
  area: z.enum(["main-right", "secondary", "overlay"]).optional(),
  defaultPx: z.number().int().positive().optional(),
  minPx: z.number().int().positive().optional(),
  maxPx: z.number().int().positive().optional(),
});

export const extensionControlsRendererRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  resourceKind: z.string().optional(),
  queryCommandId: z.string(),
  updateValueCommandId: z.string().optional(),
  applyCommandId: z.string().optional(),
  resetCommandId: z.string().optional(),
  refreshEventIds: z.array(z.string()).optional(),
  defaultValues: z.record(z.string(), z.unknown()).optional(),
  emptyTitle: localizableStringSchema.optional(),
  emptyDescription: localizableStringSchema.optional(),
  layout: controlsRendererLayoutSchema.optional(),
});

export type ExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
export type WorkbenchExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
