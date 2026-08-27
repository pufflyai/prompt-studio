import { z } from "zod";
import { dockedWorkbenchRegions } from "../extension-kernel/types/composition";
import { jsonObjectSchema, localizableStringSchema } from "./common";
import { extensionResourceRefSchema } from "./execute";

export const dockedWorkbenchRegionSchema = z.enum(dockedWorkbenchRegions);

export const extensionResourceSlotSchema = z.object({
  cardinality: z.enum(["one", "many"]),
  external: z.boolean(),
});

export const extensionResourceMenuSlotSchema = z.object({
  placement: z.enum(["header-primary", "header-overflow", "context-menu"]),
  label: localizableStringSchema.optional(),
  external: z.boolean(),
  order: z.number().optional(),
});

export const extensionResourceKindRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  surface: z.enum(["primary", "secondary", "attached"]),
  label: localizableStringSchema.optional(),
  icon: z.string().optional(),
  slots: z.record(z.string(), extensionResourceSlotSchema),
  menuSlots: z.record(z.string(), extensionResourceMenuSlotSchema).default({}),
});

export const extensionResourcePanelRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  resourceKind: z.string(),
  panel: z.string(),
  slot: z.string(),
});

const panelBodySchema = {
  webview: z
    .object({ entry: z.object({ kind: z.literal("package-asset"), path: z.string(), baseUrl: z.string() }) })
    .optional(),
  renderer: z.object({ kind: z.enum(["tree", "file", "controls", "dataTable", "kanban"]), id: z.string() }).optional(),
};

export const extensionModePlacementSchema = z.object({
  region: dockedWorkbenchRegionSchema,
  allowedRegions: z.array(dockedWorkbenchRegionSchema).optional(),
  required: z.boolean().optional(),
  defaultOpen: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export const extensionPanelPlacementSchema = z.object({
  for: z.string().optional(),
  region: dockedWorkbenchRegionSchema,
  allowedRegions: z.array(dockedWorkbenchRegionSchema).optional(),
  required: z.boolean().optional(),
});

export const extensionCompositionPanelRecordSchema = z
  .object({
    id: z.string(),
    extensionId: z.string(),
    title: localizableStringSchema,
    icon: z.string().optional(),
    show: z.union([extensionPanelPlacementSchema, z.array(extensionPanelPlacementSchema).min(1)]).optional(),
    ...panelBodySchema,
  })
  .refine((value) => [value.webview, value.renderer].filter(Boolean).length === 1, {
    message: "Composition panels must declare exactly one body",
  });

export const extensionModeResourceRecipeSchema = z.object({
  slots: z.record(z.string(), extensionModePlacementSchema).optional(),
  panels: z.record(z.string(), extensionModePlacementSchema).optional(),
});

export const extensionModeCompositionRecordSchema = z.object({
  resources: z.record(z.string(), extensionModeResourceRecipeSchema),
  modePanels: z.record(z.string(), extensionModePlacementSchema).optional(),
  defaultResource: z.union([extensionResourceRefSchema, z.object({ commandId: z.string() })]).optional(),
});

export const workbenchNavigationTargetSchema = z.object({
  modeId: z.string().optional(),
  resource: extensionResourceRefSchema.optional(),
  replaceActive: z.boolean().optional(),
});

export const extensionResourceHierarchyProviderRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  resourceKind: z.string(),
  metadata: jsonObjectSchema.optional(),
});

export type ExtensionResourceKindRecord = z.infer<typeof extensionResourceKindRecordSchema>;
export type ExtensionResourcePanelRecord = z.infer<typeof extensionResourcePanelRecordSchema>;
export type ExtensionCompositionPanelRecord = z.infer<typeof extensionCompositionPanelRecordSchema>;
export type ExtensionModeCompositionRecord = z.infer<typeof extensionModeCompositionRecordSchema>;
