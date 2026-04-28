import type { Status, Tag, TagOption, TicketListItem } from "../resources";
import type { RequestFn } from "./request";

export const PLANNER_EXTENSION_ID = "pstdio.planner";

export type PlannerCollectionRow = {
  id: string;
  project_id: string;
  item_id: string;
  value_json: unknown;
  created_at: string;
  updated_at: string;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asBoolean = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);
const asNumber = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);

export const listPlannerCollection = async (request: RequestFn, projectId: string, collection: string) => {
  const response = await request<{ items: PlannerCollectionRow[] }>(
    `/v1/projects/${projectId}/extensions/${PLANNER_EXTENSION_ID}/collections/${collection}`,
  );
  return response.items;
};

export const executePlannerCommand = (request: RequestFn, projectId: string, command: string, params: unknown) =>
  request<{ result: unknown }>(
    `/v1/projects/${projectId}/extension-commands/${PLANNER_EXTENSION_ID}.${command}/execute`,
    {
      method: "POST",
      body: { params },
    },
  ).then((response) => response.result);

export const toPlannerStatus = (projectId: string, row: PlannerCollectionRow, index: number): Status => {
  const value = asRecord(row.value_json);
  const id = asString(value.id, row.item_id);
  const columnActions = value.columnActions ?? value.column_actions;

  return {
    id,
    project_id: projectId,
    name: asString(value.name, id),
    color: asString(value.color, "gray"),
    sort_order: asNumber(value.sortOrder ?? value.sort_order, index + 1),
    is_default: asBoolean(value.isDefault ?? value.is_default, index === 0),
    can_create: asBoolean(value.canCreate ?? value.can_create, index === 0),
    can_drag_in: asBoolean(value.canDragIn ?? value.can_drag_in, true),
    can_drag_out: asBoolean(value.canDragOut ?? value.can_drag_out, true),
    column_actions: Array.isArray(columnActions)
      ? columnActions.filter((action): action is string => typeof action === "string")
      : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: null,
  };
};

export const toPlannerStatusFromValue = (projectId: string, value: unknown, index = 0) =>
  toPlannerStatus(
    projectId,
    {
      id: "",
      project_id: projectId,
      item_id: asString(asRecord(value).id),
      value_json: value,
      created_at: "",
      updated_at: "",
    },
    index,
  );

const toPlannerTagOption = (row: PlannerCollectionRow, index: number): TagOption => {
  const value = asRecord(row.value_json);
  const id = asString(value.id, row.item_id);

  return {
    id,
    name: asString(value.name, id),
    color: asString(value.color, "gray"),
    sort_order: asNumber(value.sortOrder ?? value.sort_order, index + 1),
    icon: (value.icon as string | null | undefined) ?? null,
    description: (value.description as string | null | undefined) ?? null,
  };
};

export const toPlannerTags = (
  projectId: string,
  tagRows: PlannerCollectionRow[],
  optionRows: PlannerCollectionRow[],
) => {
  const options = optionRows.map((row, index) => ({
    tagId: asString(asRecord(row.value_json).tagId ?? asRecord(row.value_json).tag_id),
    option: toPlannerTagOption(row, index),
  }));

  return tagRows.map((row) => {
    const value = asRecord(row.value_json);
    const id = asString(value.id, row.item_id);

    return {
      id,
      project_id: projectId,
      name: asString(value.name, id),
      type: asString(value.type, "single_select"),
      options: options.filter((candidate) => candidate.tagId === id).map((candidate) => candidate.option),
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: null,
    } satisfies Tag;
  });
};

export const toPlannerTagFromValue = (projectId: string, value: unknown) => {
  const record = asRecord(value);
  const options = Array.isArray(record.options) ? record.options : [];

  return toPlannerTags(
    projectId,
    [
      {
        id: "",
        project_id: projectId,
        item_id: asString(record.id),
        value_json: value,
        created_at: "",
        updated_at: "",
      },
    ],
    options.map((option) => ({
      id: "",
      project_id: projectId,
      item_id: asString(asRecord(option).id),
      value_json: { ...asRecord(option), tagId: asString(record.id) },
      created_at: "",
      updated_at: "",
    })),
  )[0]!;
};

export const toPlannerTagOptionFromValue = (value: unknown) =>
  toPlannerTagOption(
    {
      id: "",
      project_id: "",
      item_id: asString(asRecord(value).id),
      value_json: value,
      created_at: "",
      updated_at: "",
    },
    0,
  );

export const toPlannerTicketListItem = (row: PlannerCollectionRow): TicketListItem => {
  const value = asRecord(row.value_json);
  const id = asString(value.id, row.item_id);
  const tagNames = Array.isArray(value.tagNames)
    ? value.tagNames.filter((tagName): tagName is string => typeof tagName === "string")
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
};
