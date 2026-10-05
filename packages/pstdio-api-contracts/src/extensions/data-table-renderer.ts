import { z } from "zod";
import { viewFilterGroupSchema, viewSortsSchema } from "./collection-view";
import { localizableStringSchema } from "./common";
import { extensionRendererRecordBaseSchema } from "./renderers";
import { viewToolbarActionRecordSchema } from "./view-toolbar-action";

const themeColorSchema = z.object({
  light: z.string(),
  dark: z.string(),
  foreground: z.object({ light: z.string(), dark: z.string() }).optional(),
});

const columnStatSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("unique") }),
  z.object({ type: z.literal("histogram"), bins: z.number().int().positive().optional() }),
  z.object({ type: z.literal("top-values"), limit: z.number().int().positive().optional() }),
]);

const columnRendererSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("json") }),
  z.object({
    type: z.literal("color-scale"),
    stops: z.array(z.object({ value: z.number(), color: themeColorSchema })),
  }),
  z.object({
    type: z.literal("categorical-color"),
    categories: z.array(
      z.object({ value: z.union([z.string(), z.number(), z.boolean(), z.null()]), color: themeColorSchema }),
    ),
  }),
]);

export const dataTableRendererColumnSchema = z.object({
  id: z.string(),
  label: localizableStringSchema.optional(),
  type: z.enum(["string", "number", "boolean", "date"]).optional(),
  groupable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  description: localizableStringSchema.optional(),
  icon: z.string().optional(),
  hidden: z.boolean().optional(),
  stat: columnStatSchema.optional(),
  renderer: columnRendererSchema.optional(),
});

export const dataTableRendererSettingsSchema = z.object({
  grouping: z.string(),
  rowNumbers: z.boolean(),
  wrapRows: z.boolean(),
  showStats: z.boolean(),
  hiddenColumns: z.array(z.string()),
  columnOrder: z.array(z.string()),
});

const dataTableRendererSavedViewSchema = z.object({
  id: z.string(),
  title: localizableStringSchema,
  settings: dataTableRendererSettingsSchema.partial().optional(),
  filter: viewFilterGroupSchema.optional(),
  sorts: viewSortsSchema.optional(),
});

const rowActionSchema = z.object({
  id: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
  destructive: z.boolean().optional(),
  commandId: z.string(),
});

const selectionActionSchema = z.object({
  id: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
  destructive: z.boolean().optional(),
  commandId: z.string(),
});

export const extensionDataTableRendererRecordSchema = extensionRendererRecordBaseSchema.extend({
  toolbarActions: z.array(viewToolbarActionRecordSchema).optional(),
  columns: z.array(dataTableRendererColumnSchema).optional(),
  queryHandlerId: z.string(),
  selectionMode: z.enum(["none", "multiple"]).optional(),
  selectionActions: z.array(selectionActionSchema).optional(),
  rowActions: z.array(rowActionSchema).optional(),
  rowActivationHandlerId: z.string().optional(),
  initialPageSize: z.number().int().positive().optional(),
  pageSizeOptions: z.array(z.number().int().positive()).optional(),
  defaultSettings: dataTableRendererSettingsSchema.partial().optional(),
  defaultFilter: viewFilterGroupSchema.optional(),
  defaultSorts: viewSortsSchema.optional(),
  defaultViews: z.array(dataTableRendererSavedViewSchema).optional(),
  defaultActiveViewId: z.string().optional(),
});

export type ExtensionDataTableRendererRecord = z.infer<typeof extensionDataTableRendererRecordSchema>;
export type WorkbenchExtensionDataTableRendererRecord = ExtensionDataTableRendererRecord;
