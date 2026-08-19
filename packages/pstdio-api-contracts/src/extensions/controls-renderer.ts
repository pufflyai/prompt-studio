import { z } from "zod";
import { extensionRendererRecordBaseSchema } from "./renderers";

export const extensionControlsRendererRecordSchema = extensionRendererRecordBaseSchema.extend({
  queryHandlerId: z.string(),
  valueChangeHandlerId: z.string().optional(),
  applyHandlerId: z.string().optional(),
  resetHandlerId: z.string().optional(),
  defaultValues: z.record(z.string(), z.unknown()).optional(),
});

export type ExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
export type WorkbenchExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
