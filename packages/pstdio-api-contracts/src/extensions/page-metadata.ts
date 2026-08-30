import { z } from "zod";
import { dockedWorkbenchRegions } from "../extension-kernel/types/composition";
import { localizableStringSchema } from "./common";
import { extensionResourceRefSchema } from "./execute";

export const pageRefSchema = z.object({ extensionId: z.string(), kind: z.literal("page"), id: z.string() });
export const placementRefSchema = z.object({ extensionId: z.string(), kind: z.literal("placement"), id: z.string() });
export const pageSlotRefSchema = z.object({
  kind: z.literal("page-slot"),
  page: pageRefSchema,
  id: z.string(),
});
export const panelRefSchema = z.union([placementRefSchema, pageSlotRefSchema]);

const modeRefSchema = z.object({ extensionId: z.string(), kind: z.literal("mode"), id: z.string() });
const viewRefSchema = z.object({ extensionId: z.string(), kind: z.literal("view"), id: z.string() });
const resourceKindRefSchema = z.object({
  extensionId: z.string(),
  kind: z.literal("resource-kind"),
  id: z.string(),
});

const bindingSchema = z.object({ kind: resourceKindRefSchema, view: viewRefSchema });
const slotSchema = z.object({
  id: z.string(),
  role: z.enum(["primary", "auxiliary"]),
  region: z.enum(dockedWorkbenchRegions),
  view: viewRefSchema.optional(),
  binding: bindingSchema.optional(),
  cardinality: z.enum(["one", "many"]).optional(),
  closable: z.boolean().optional(),
  defaultOpen: z.boolean().optional(),
  defaultResource: extensionResourceRefSchema.optional(),
  order: z.number().optional(),
});

export const workbenchExtensionPageRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  icon: z.string().optional(),
  path: z.string(),
  mode: modeRefSchema,
  parent: pageRefSchema.optional(),
  slots: z.array(slotSchema),
});
