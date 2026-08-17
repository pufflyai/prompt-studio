import { z } from "zod";
import { localizableStringSchema } from "./common";

export const extensionControlsRendererRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  queryHandlerId: z.string(),
  valueChangeHandlerId: z.string().optional(),
  applyHandlerId: z.string().optional(),
  resetHandlerId: z.string().optional(),
  refreshEventIds: z.array(z.string()).optional(),
  defaultValues: z.record(z.string(), z.unknown()).optional(),
  emptyTitle: localizableStringSchema.optional(),
  emptyDescription: localizableStringSchema.optional(),
});

export type ExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
export type WorkbenchExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
