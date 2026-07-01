import { z } from "zod";
import { localizableStringSchema } from "./common";

export const extensionControlsRendererRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  queryCommandId: z.string(),
  updateValueCommandId: z.string().optional(),
  applyCommandId: z.string().optional(),
  resetCommandId: z.string().optional(),
  refreshEventIds: z.array(z.string()).optional(),
  defaultValues: z.record(z.string(), z.unknown()).optional(),
  emptyTitle: localizableStringSchema.optional(),
  emptyDescription: localizableStringSchema.optional(),
});

export type ExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
export type WorkbenchExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
