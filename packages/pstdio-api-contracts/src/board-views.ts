import { z } from "zod";
import { kanbanRendererSettingsSchema } from "./extensions/kanban-renderer";

export const boardFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["enum", "enum-multi", "status", "string", "date", "number", "user"]),
  filterable: z.boolean(),
  groupable: z.boolean(),
  sortable: z.boolean(),
  displayable: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});
export const boardSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  extensionId: z.string(),
  fields: z.array(boardFieldSchema),
});
export const boardFiltersSchema = z.record(z.string(), z.array(z.string()));
export const boardViewSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  title: z.string(),
  settings: kanbanRendererSettingsSchema,
  filters: boardFiltersSchema,
  builtIn: z.boolean(),
});
export const boardViewsSchema = z.object({ views: z.array(boardViewSchema), defaultViewId: z.string() });
export const boardViewUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    settings: kanbanRendererSettingsSchema.partial().optional(),
    filters: boardFiltersSchema.optional(),
  })
  .strict();
export const boardViewCreateSchema = boardViewUpdateSchema.extend({
  title: z.string().trim().min(1),
  copyFrom: z.string().optional(),
});
export type BoardSummary = z.infer<typeof boardSummarySchema>;
export type BoardField = z.infer<typeof boardFieldSchema>;
export type BoardView = z.infer<typeof boardViewSchema>;
export type BoardViews = z.infer<typeof boardViewsSchema>;
export type BoardViewCreate = z.infer<typeof boardViewCreateSchema>;
export type BoardViewUpdate = z.infer<typeof boardViewUpdateSchema>;

// The sync key is derived from the database's composite primary key, never stored twice.
export const boardDefaultSyncRow = <T extends { project_id: string; extension_instance_id: string; board_id: string }>(
  row: T,
) => ({ ...row, id: JSON.stringify([row.project_id, row.extension_instance_id, row.board_id]) });
