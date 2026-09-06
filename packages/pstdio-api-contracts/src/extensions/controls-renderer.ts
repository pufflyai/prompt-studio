import { z } from "zod";
import { controlValuesSchema } from "./control-declarations";
import { extensionRendererRecordBaseSchema } from "./renderers";

export const extensionControlsRendererRecordSchema = extensionRendererRecordBaseSchema.extend({
  queryHandlerId: z.string(),
  valueChangeHandlerId: z.string().optional(),
  applyHandlerId: z.string().optional(),
  resetHandlerId: z.string().optional(),
  defaultValues: controlValuesSchema.optional(),
});

export type ExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
export type WorkbenchExtensionControlsRendererRecord = z.infer<typeof extensionControlsRendererRecordSchema>;
