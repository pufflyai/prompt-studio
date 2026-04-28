import type { Status, TicketListItem } from "../../resources";
import type { PluginHelperContext } from "./context";

export const PLANNER_EXTENSION_ID = "pstdio.planner";

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asBoolean = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);

export const executePlannerCommand = (ctx: PluginHelperContext, commandId: string, params: Record<string, unknown>) =>
  ctx.client.extensionCommands.execute(ctx.projectId, commandId, { params });

export const listPlannerTickets = async (ctx: PluginHelperContext): Promise<TicketListItem[]> => {
  const rows = await ctx.client.extensions.listCollection(ctx.projectId, PLANNER_EXTENSION_ID, "tickets");
  return rows.map((row) => {
    const value = asRecord(row.value_json);
    const id = asString(value.id, row.item_id);
    const tagNames = Array.isArray(value.tagNames)
      ? value.tagNames.filter((tag): tag is string => typeof tag === "string")
      : [];

    return {
      id,
      shorthand: asString(value.shorthand, id),
      project_id: asString(value.projectId, row.project_id),
      status_id: (value.statusId as string | null | undefined) ?? null,
      status_name: null,
      display_title: (value.displayTitle as string | null | undefined) ?? null,
      user_prompt: (value.userPrompt as string | null | undefined) ?? null,
      file_id: (value.fileId as string | null | undefined) ?? null,
      parent_id: (value.parentId as string | null | undefined) ?? null,
      parallelizable: (value.parallelizable as string | null | undefined) ?? null,
      blocked_reason: (value.blockedReason as string | null | undefined) ?? null,
      depends_on: (value.dependsOn as string | null | undefined) ?? null,
      draft: asBoolean(value.draft),
      archived: asBoolean(value.archived),
      deleted_at: null,
      created_at: asString(value.createdAt, row.created_at),
      updated_at: asString(value.updatedAt, row.updated_at),
      tag_ids: tagNames,
      tag_names: tagNames,
    };
  });
};

export const listPlannerStatuses = async (ctx: PluginHelperContext): Promise<Status[]> => {
  const rows = await ctx.client.extensions.listCollection(ctx.projectId, PLANNER_EXTENSION_ID, "statuses");
  return rows.map((row, index) => {
    const value = asRecord(row.value_json);
    const id = asString(value.id, row.item_id);

    return {
      id,
      project_id: row.project_id,
      name: asString(value.name, id),
      color: asString(value.color, "gray"),
      sort_order: typeof value.sortOrder === "number" ? value.sortOrder : index + 1,
      is_default: asBoolean(value.isDefault, index === 0),
      can_create: asBoolean(value.canCreate, index === 0),
      can_drag_in: asBoolean(value.canDragIn, true),
      can_drag_out: asBoolean(value.canDragOut, true),
      column_actions: Array.isArray(value.columnActions) ? value.columnActions : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: null,
    };
  });
};
