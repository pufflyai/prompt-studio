import { z } from "zod";
import { extensionParamObjectSchema } from "./commands";
import { localizableStringSchema } from "./common";

const dataRendererEnumOptionSchema = z.object({
  value: z.string(),
  label: localizableStringSchema,
  color: z.string().optional(),
  icon: z.string().nullable().optional(),
});

const dataRendererAttributeTypeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("enum"), options: z.array(dataRendererEnumOptionSchema) }),
  z.object({ kind: z.literal("enum-multi"), options: z.array(dataRendererEnumOptionSchema) }),
  z.object({ kind: z.literal("string") }),
  z.object({ kind: z.literal("date") }),
  z.object({ kind: z.literal("number") }),
  z.object({ kind: z.literal("user") }),
]);

const dataRendererAttributeDisplaySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace-badge"), itemsAttributeId: z.string() }),
]);

const dataRendererAttributeSchema = z.object({
  id: z.string(),
  label: localizableStringSchema,
  type: dataRendererAttributeTypeSchema,
  filterable: z.boolean().optional(),
  groupable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  displayable: z.boolean().optional(),
  editable: z.boolean().optional(),
  display: dataRendererAttributeDisplaySchema.optional(),
});

const dataRendererSettingsSchema = z.object({
  viewMode: z.enum(["board", "list"]),
  columnGrouping: z.string(),
  rowGrouping: z.string(),
  ordering: z.object({
    attributeId: z.string(),
    direction: z.enum(["asc", "desc"]),
  }),
  displayProperties: z.array(z.string()),
});

const extensionDataRendererCreateRowSchema = z.object({
  commandId: z.string(),
  title: localizableStringSchema.optional(),
  submitLabel: localizableStringSchema.optional(),
  columnParam: z.string().optional(),
  params: extensionParamObjectSchema.optional(),
});

const extensionDataRendererRowActionSchema = z.object({
  id: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
  commandId: z.string(),
  destructive: z.boolean().optional(),
});

export const extensionDataRendererRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  resourceKind: z.string().optional(),
  attributes: z.array(dataRendererAttributeSchema).optional(),
  queryCommandId: z.string(),
  updateAttributeCommandId: z.string().optional(),
  reorderCommandId: z.string().optional(),
  columnActionCommandId: z.string().optional(),
  createRow: extensionDataRendererCreateRowSchema.optional(),
  rowActions: z.array(extensionDataRendererRowActionSchema).optional(),
  defaultSettings: dataRendererSettingsSchema.partial().optional(),
  defaultFilters: z.record(z.string(), z.array(z.string())).optional(),
  emptyTitle: localizableStringSchema.optional(),
  emptyDescription: localizableStringSchema.optional(),
  hideToolbar: z.boolean().optional(),
  savedViews: z
    .object({
      resourceKind: z.string(),
      scope: z.enum(["project", "user"]).optional(),
    })
    .optional(),
});

export const extensionCommandPaletteResourceRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  resourceKind: z.string().optional(),
  queryCommandId: z.string(),
  refreshEventIds: z.array(z.string()).optional(),
});

export type ExtensionDataRendererRecord = z.infer<typeof extensionDataRendererRecordSchema>;
export type ExtensionCommandPaletteResourceRecord = z.infer<typeof extensionCommandPaletteResourceRecordSchema>;
export type WorkbenchExtensionDataRendererRecord = z.infer<typeof extensionDataRendererRecordSchema>;
export type WorkbenchExtensionCommandPaletteResourceRecord = z.infer<
  typeof extensionCommandPaletteResourceRecordSchema
>;
