import { z } from "zod";
import { viewFilterGroupSchema, viewSortSchema } from "./collection-view";
import { extensionParamObjectSchema } from "./commands";
import { localizableStringSchema } from "./common";
import { extensionRendererRecordBaseSchema } from "./renderers";
import { viewToolbarActionRecordSchema } from "./view-toolbar-action";

const kanbanRendererEnumOptionSchema = z.object({
  value: z.string(),
  label: localizableStringSchema,
  color: z.string().optional(),
  icon: z.string().nullable().optional(),
});

const kanbanRendererAttributeTypeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("enum"), options: z.array(kanbanRendererEnumOptionSchema) }),
  z.object({ kind: z.literal("enum-multi"), options: z.array(kanbanRendererEnumOptionSchema) }),
  z.object({
    kind: z.literal("status"),
    statuses: z.object({
      extensionId: z.string().optional(),
      kind: z.literal("status"),
      id: z.string(),
    }),
  }),
  z.object({ kind: z.literal("string") }),
  z.object({ kind: z.literal("date") }),
  z.object({ kind: z.literal("number") }),
  z.object({ kind: z.literal("user") }),
]);

const kanbanRendererAttributeDisplaySchema = z.union([
  z.object({ kind: z.literal("badge-list"), itemsAttributeId: z.string() }),
  z
    .object({ kind: z.string() })
    .passthrough()
    .refine((display) => display.kind !== "badge-list"),
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

/** Board display settings stored in a view. Order lives in the view's sorts. */
export const kanbanViewSettingsSchema = z.object({
  viewMode: z.enum(["board", "list"]),
  columnGrouping: z.string(),
  rowGrouping: z.string(),
  displayProperties: z.array(z.string()),
});

export const kanbanRendererSavedViewSchema = z.object({
  id: z.string(),
  title: localizableStringSchema,
  settings: kanbanViewSettingsSchema,
  filter: viewFilterGroupSchema,
  sorts: z.array(viewSortSchema),
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

export const extensionKanbanRendererRecordSchema = extensionRendererRecordBaseSchema.extend({
  toolbarActions: z.array(viewToolbarActionRecordSchema).optional(),
  extensionInstanceId: z.string().optional(),
  attributes: z.array(kanbanRendererAttributeSchema).optional(),
  queryHandlerId: z.string(),
  attributeChangeHandlerId: z.string().optional(),
  reorderHandlerId: z.string().optional(),
  columnActionHandlerId: z.string().optional(),
  createRow: extensionKanbanRendererCreateRowSchema.optional(),
  rowActions: z.array(extensionKanbanRendererRowActionSchema).optional(),
  rowActivationHandlerId: z.string().optional(),
  defaultSettings: kanbanViewSettingsSchema.partial().optional(),
  defaultFilter: viewFilterGroupSchema.optional(),
  defaultSorts: z.array(viewSortSchema).optional(),
  defaultViews: z.array(kanbanRendererSavedViewSchema).optional(),
  defaultActiveViewId: z.string().optional(),
  hideToolbar: z.boolean().optional(),
});

export const extensionCommandPaletteResourceRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  resourceKind: z.string().optional(),
  queryHandlerId: z.string(),
  refreshEventIds: z.array(z.string().min(1)).optional(),
});

export type ExtensionKanbanRendererRecord = z.infer<typeof extensionKanbanRendererRecordSchema>;
export type ExtensionCommandPaletteResourceRecord = z.infer<typeof extensionCommandPaletteResourceRecordSchema>;
export type WorkbenchExtensionKanbanRendererRecord = z.infer<typeof extensionKanbanRendererRecordSchema>;
export type WorkbenchExtensionCommandPaletteResourceRecord = z.infer<
  typeof extensionCommandPaletteResourceRecordSchema
>;
