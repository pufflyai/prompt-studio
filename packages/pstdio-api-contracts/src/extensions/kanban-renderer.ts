import { z } from "zod";
import { extensionParamObjectSchema } from "./commands";
import { localizableStringSchema } from "./common";

const kanbanRendererEnumOptionSchema = z.object({
  value: z.string(),
  label: localizableStringSchema,
  color: z.string().optional(),
  icon: z.string().nullable().optional(),
});

const kanbanRendererAttributeTypeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("enum"), options: z.array(kanbanRendererEnumOptionSchema) }),
  z.object({ kind: z.literal("enum-multi"), options: z.array(kanbanRendererEnumOptionSchema) }),
  z.object({ kind: z.literal("string") }),
  z.object({ kind: z.literal("date") }),
  z.object({ kind: z.literal("number") }),
  z.object({ kind: z.literal("user") }),
]);

const kanbanRendererAttributeDisplaySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace-badge"), itemsAttributeId: z.string() }),
]);

const kanbanRendererAttributeSchema = z.object({
  id: z.string(),
  label: localizableStringSchema,
  type: kanbanRendererAttributeTypeSchema,
  filterable: z.boolean().optional(),
  groupable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  displayable: z.boolean().optional(),
  editable: z.boolean().optional(),
  display: kanbanRendererAttributeDisplaySchema.optional(),
});

const kanbanRendererSettingsSchema = z.object({
  viewMode: z.enum(["board", "list"]),
  columnGrouping: z.string(),
  rowGrouping: z.string(),
  ordering: z.object({
    attributeId: z.string(),
    direction: z.enum(["asc", "desc"]),
  }),
  displayProperties: z.array(z.string()),
});

const kanbanRendererSavedViewSchema = z.object({
  id: z.string(),
  title: localizableStringSchema,
  settings: kanbanRendererSettingsSchema,
  filters: z.record(z.string(), z.array(z.string())),
  isDefault: z.boolean().optional(),
});

const extensionKanbanRendererCreateRowSchema = z.object({
  commandId: z.string(),
  title: localizableStringSchema.optional(),
  submitLabel: localizableStringSchema.optional(),
  columnParam: z.string().optional(),
  params: extensionParamObjectSchema.optional(),
  attributesParam: z.string().optional(),
  attachments: z
    .object({
      commandId: z.string(),
      resourceParam: z.string(),
      fileParam: z.string(),
    })
    .optional(),
  labels: z
    .object({
      cancel: localizableStringSchema.optional(),
      properties: localizableStringSchema.optional(),
      submitError: localizableStringSchema.optional(),
      removeFile: localizableStringSchema.optional(),
    })
    .optional(),
});

const extensionKanbanRendererRowActionSchema = z.object({
  id: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
  commandId: z.string(),
  destructive: z.boolean().optional(),
});

export const extensionKanbanRendererRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  extensionInstanceId: z.string().optional(),
  title: localizableStringSchema,
  resourceKind: z.string().optional(),
  attributes: z.array(kanbanRendererAttributeSchema).optional(),
  queryCommandId: z.string(),
  updateAttributeCommandId: z.string().optional(),
  reorderCommandId: z.string().optional(),
  columnActionCommandId: z.string().optional(),
  createRow: extensionKanbanRendererCreateRowSchema.optional(),
  rowActions: z.array(extensionKanbanRendererRowActionSchema).optional(),
  defaultSettings: kanbanRendererSettingsSchema.partial().optional(),
  defaultFilters: z.record(z.string(), z.array(z.string())).optional(),
  defaultViews: z.array(kanbanRendererSavedViewSchema).optional(),
  defaultActiveViewId: z.string().optional(),
  emptyTitle: localizableStringSchema.optional(),
  emptyDescription: localizableStringSchema.optional(),
  hideToolbar: z.boolean().optional(),
});

export const extensionCommandPaletteResourceRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  resourceKind: z.string().optional(),
  queryCommandId: z.string(),
  refreshEventIds: z.array(z.string()).optional(),
});

export type ExtensionKanbanRendererRecord = z.infer<typeof extensionKanbanRendererRecordSchema>;
export type ExtensionCommandPaletteResourceRecord = z.infer<typeof extensionCommandPaletteResourceRecordSchema>;
export type WorkbenchExtensionKanbanRendererRecord = z.infer<typeof extensionKanbanRendererRecordSchema>;
export type WorkbenchExtensionCommandPaletteResourceRecord = z.infer<
  typeof extensionCommandPaletteResourceRecordSchema
>;
