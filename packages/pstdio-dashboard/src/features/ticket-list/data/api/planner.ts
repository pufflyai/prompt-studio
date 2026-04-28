import type { StatusResponse, TagOptionResponse, TagResponse } from "pstdio-api/dto";
import { apiRequest } from "@/lib/api";
import type { ApiTicket } from "./types";

export const PLANNER_EXTENSION_ID = "pstdio.planner";

type PlannerCollectionRow = {
  id: string;
  project_id: string;
  item_id: string;
  value_json: unknown;
  created_at: string;
  updated_at: string;
};

type PlannerCommandResponse<TResult> = {
  result: TResult;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asBoolean = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);
const asNumber = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);

export const listPlannerCollection = async (projectId: string, collection: string) => {
  const response = await apiRequest<{ items: PlannerCollectionRow[] }>(
    `/v1/projects/${projectId}/extensions/${PLANNER_EXTENSION_ID}/collections/${collection}`,
  );
  return response.items;
};

export const executePlannerCommand = async <TResult>(
  projectId: string,
  command: string,
  params: Record<string, unknown>,
) => {
  const response = await apiRequest<PlannerCommandResponse<TResult>>(
    `/v1/projects/${projectId}/extension-commands/${PLANNER_EXTENSION_ID}.${command}/execute`,
    {
      method: "POST",
      body: { params },
    },
  );
  return response.result;
};

export const toPlannerStatusResponse = (row: PlannerCollectionRow, index: number): StatusResponse => {
  const value = asRecord(row.value_json);
  const id = asString(value.id, row.item_id);

  return {
    id,
    project_id: row.project_id,
    name: asString(value.name, id),
    color: asString(value.color, "gray"),
    sort_order: asNumber(value.sortOrder ?? value.sort_order, index + 1),
    is_default: asBoolean(value.isDefault ?? value.is_default, index === 0),
    can_drag_out: asBoolean(value.canDragOut ?? value.can_drag_out, true),
    can_drag_in: asBoolean(value.canDragIn ?? value.can_drag_in, true),
    can_create: asBoolean(value.canCreate ?? value.can_create, index === 0),
    column_actions: Array.isArray(value.columnActions ?? value.column_actions)
      ? (value.columnActions ?? value.column_actions)
      : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: null,
  } as StatusResponse;
};

const toPlannerTagOptionResponse = (row: PlannerCollectionRow, index: number): TagOptionResponse => {
  const value = asRecord(row.value_json);
  const id = asString(value.id, row.item_id);

  return {
    id,
    name: asString(value.name, id),
    color: asString(value.color, "gray"),
    sort_order: asNumber(value.sortOrder ?? value.sort_order, index + 1),
    icon: (value.icon as string | null | undefined) ?? null,
    description: (value.description as string | null | undefined) ?? null,
  } as TagOptionResponse;
};

export const toPlannerTagResponses = (tagRows: PlannerCollectionRow[], optionRows: PlannerCollectionRow[]) => {
  const optionResponses = optionRows.map((row, index) => {
    const value = asRecord(row.value_json);
    return {
      tagId: asString(value.tagId ?? value.tag_id),
      option: toPlannerTagOptionResponse(row, index),
    };
  });

  return tagRows.map((row) => {
    const value = asRecord(row.value_json);
    const id = asString(value.id, row.item_id);

    return {
      id,
      project_id: row.project_id,
      name: asString(value.name, id),
      type: asString(value.type, "single_select"),
      options: optionResponses.filter((candidate) => candidate.tagId === id).map((candidate) => candidate.option),
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: null,
    } as TagResponse;
  });
};

export const toPlannerTicket = (
  row: PlannerCollectionRow,
  statusNameById: Map<string, string>,
  tagNameById: Map<string, string>,
): ApiTicket => {
  const value = asRecord(row.value_json);
  const id = asString(value.id, row.item_id);
  const statusId = (value.statusId as string | null | undefined) ?? null;
  const tagIds = Array.isArray(value.tagNames)
    ? value.tagNames.filter((tagId): tagId is string => typeof tagId === "string")
    : [];

  return {
    id,
    shorthand: asString(value.shorthand, id),
    project_id: asString(value.projectId, row.project_id),
    status_id: statusId,
    status_name: statusId ? (statusNameById.get(statusId) ?? statusId) : null,
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
    tag_ids: tagIds,
    tag_names: tagIds.map((tagId) => tagNameById.get(tagId) ?? tagId),
    attempts: [],
    sub_tickets: [],
  };
};

export const toPlannerTicketFromValue = (
  projectId: string,
  value: unknown,
  statusNameById: Map<string, string>,
  tagNameById = new Map<string, string>(),
) =>
  toPlannerTicket(
    {
      id: "",
      project_id: projectId,
      item_id: asString(asRecord(value).id, asString(asRecord(value).shorthand)),
      value_json: value,
      created_at: asString(asRecord(value).createdAt),
      updated_at: asString(asRecord(value).updatedAt),
    },
    statusNameById,
    tagNameById,
  );

export const readPlannerTicketContent = (row: PlannerCollectionRow | undefined) =>
  asString(asRecord(row?.value_json).content);
