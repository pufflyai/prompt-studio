import { z } from "zod";
import { localizableStringSchema } from "./common";

export const extensionRendererRecordBaseSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  icon: z.string().optional(),
  resourceKind: z.string().optional(),
  refreshEventIds: z.array(z.string().min(1)).optional(),
  emptyTitle: localizableStringSchema.optional(),
  emptyDescription: localizableStringSchema.optional(),
});

export const extensionTreeRendererRecordSchema = extensionRendererRecordBaseSchema.extend({
  searchable: z.boolean().optional(),
  searchPlaceholder: localizableStringSchema.optional(),
  bodyHandlerId: z.string(),
  childrenHandlerId: z.string().optional(),
  footerHandlerId: z.string().optional(),
  defaultExpandedSectionIds: z.array(z.string()).optional(),
  defaultExpandedNodeIds: z.array(z.string()).optional(),
});

export const extensionFileRendererRecordSchema = extensionRendererRecordBaseSchema.extend({
  loadHandlerId: z.string(),
  saveHandlerId: z.string().optional(),
});

export type ExtensionTreeRendererRecord = z.infer<typeof extensionTreeRendererRecordSchema>;
export type ExtensionFileRendererRecord = z.infer<typeof extensionFileRendererRecordSchema>;
export type WorkbenchExtensionFileRendererRecord = z.infer<typeof extensionFileRendererRecordSchema>;
export type WorkbenchExtensionTreeRendererRecord = z.infer<typeof extensionTreeRendererRecordSchema>;
