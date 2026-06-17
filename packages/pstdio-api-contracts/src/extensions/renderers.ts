import { z } from "zod";
import { localizableStringSchema } from "./common";

export const extensionTreeRendererRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  icon: z.string().optional(),
  bodyCommandId: z.string(),
  childrenCommandId: z.string().optional(),
  footerCommandId: z.string().optional(),
  defaultExpandedSectionIds: z.array(z.string()).optional(),
  defaultExpandedNodeIds: z.array(z.string()).optional(),
});

export const extensionFileRendererRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  icon: z.string().optional(),
  resourceKind: z.string().optional(),
  loadCommandId: z.string(),
  saveCommandId: z.string().optional(),
});

export type ExtensionTreeRendererRecord = z.infer<typeof extensionTreeRendererRecordSchema>;
export type ExtensionFileRendererRecord = z.infer<typeof extensionFileRendererRecordSchema>;
export type WorkbenchExtensionFileRendererRecord = z.infer<typeof extensionFileRendererRecordSchema>;
export type WorkbenchExtensionTreeRendererRecord = z.infer<typeof extensionTreeRendererRecordSchema>;
