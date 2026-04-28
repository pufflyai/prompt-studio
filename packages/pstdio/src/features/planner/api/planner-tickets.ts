import { createRequest, type RequestFn } from "@pstdio/sdk/client";
import type { TicketDetail, TicketListItem } from "@pstdio/sdk/resources";
import { API_URL } from "@/features/api-url";

type ListPlannerTicketsParams = {
  project_id: string;
  status?: string;
  tag?: string[];
  archived?: boolean;
  draft?: boolean;
  parent_id?: string;
  shorthand?: string;
};

type ExtensionCollectionRow = {
  item_id: string;
  value_json: unknown;
};

type ExtensionCollectionResponse = {
  items: ExtensionCollectionRow[];
};

type StoredTicket = {
  id?: string;
  projectId?: string;
  shorthand?: string;
  createdAt?: string;
  updatedAt?: string;
  draft?: boolean;
  archived?: boolean;
  fileId?: string | null;
  parentId?: string | null;
  userPrompt?: string | null;
  dependsOn?: string | null;
  parallelizable?: string | null;
  blockedReason?: string | null;
  tagNames?: unknown;
  content?: string;
  displayTitle?: string | null;
  statusId?: string | null;
};

type StoredStatus = {
  id?: string;
  name?: string;
};

const PLANNER_EXTENSION_ID = "pstdio.planner";

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asBoolean = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);

const collectionPath = (projectId: string, collection: string) =>
  `/v1/projects/${projectId}/extensions/${PLANNER_EXTENSION_ID}/collections/${collection}`;

const createPlannerRequest = () =>
  createRequest({
    baseUrl: process.env.PSTDIO_API_URL ?? API_URL,
    token: process.env.PSTDIO_API_TOKEN,
  });

const tagNamesOf = (ticket: StoredTicket) =>
  Array.isArray(ticket.tagNames)
    ? ticket.tagNames.filter((tagName): tagName is string => typeof tagName === "string")
    : [];

const toStoredTicket = (row: ExtensionCollectionRow) => {
  const value = asRecord(row.value_json) as StoredTicket;
  const id = asString(value.id, row.item_id);

  return {
    ...value,
    id,
    shorthand: asString(value.shorthand, id),
  };
};

const toStatusNameById = (rows: ExtensionCollectionRow[]) => {
  const entries: [string, string][] = [];

  for (const row of rows) {
    const status = asRecord(row.value_json) as StoredStatus;
    const id = asString(status.id);
    const name = asString(status.name);
    if (id && name) entries.push([id, name]);
  }

  return new Map(entries);
};

const toTicketListItem = (ticket: StoredTicket, statusNameById: Map<string, string>) => {
  const id = asString(ticket.id, asString(ticket.shorthand));
  const statusId = (ticket.statusId as string | null | undefined) ?? null;

  return {
    id,
    shorthand: asString(ticket.shorthand, id),
    project_id: asString(ticket.projectId),
    status_id: statusId,
    display_title: (ticket.displayTitle as string | null | undefined) ?? null,
    user_prompt: (ticket.userPrompt as string | null | undefined) ?? null,
    file_id: (ticket.fileId as string | null | undefined) ?? null,
    parent_id: (ticket.parentId as string | null | undefined) ?? null,
    parallelizable: (ticket.parallelizable as string | null | undefined) ?? null,
    blocked_reason: (ticket.blockedReason as string | null | undefined) ?? null,
    depends_on: (ticket.dependsOn as string | null | undefined) ?? null,
    draft: asBoolean(ticket.draft),
    archived: asBoolean(ticket.archived),
    deleted_at: null,
    created_at: asString(ticket.createdAt),
    updated_at: asString(ticket.updatedAt, asString(ticket.createdAt)),
    status_name: statusId ? (statusNameById.get(statusId) ?? statusId) : null,
    tag_ids: tagNamesOf(ticket),
    tag_names: tagNamesOf(ticket),
  } satisfies TicketListItem;
};

const toTicketDetail = (ticket: StoredTicket) => {
  const id = asString(ticket.id, asString(ticket.shorthand));

  return {
    id,
    shorthand: asString(ticket.shorthand, id),
    project_id: asString(ticket.projectId),
    status_id: (ticket.statusId as string | null | undefined) ?? null,
    display_title: (ticket.displayTitle as string | null | undefined) ?? null,
    user_prompt: (ticket.userPrompt as string | null | undefined) ?? null,
    file_id: (ticket.fileId as string | null | undefined) ?? null,
    parent_id: (ticket.parentId as string | null | undefined) ?? null,
    parallelizable: (ticket.parallelizable as string | null | undefined) ?? null,
    blocked_reason: (ticket.blockedReason as string | null | undefined) ?? null,
    depends_on: (ticket.dependsOn as string | null | undefined) ?? null,
    draft: asBoolean(ticket.draft),
    archived: asBoolean(ticket.archived),
    deleted_at: null,
    created_at: asString(ticket.createdAt),
    updated_at: asString(ticket.updatedAt, asString(ticket.createdAt)),
    content: asString(ticket.content),
  } satisfies TicketDetail;
};

const matchesFilters = (ticket: TicketListItem, params: ListPlannerTicketsParams) => {
  if (ticket.archived !== (params.archived ?? false)) return false;
  if (params.draft !== undefined && ticket.draft !== params.draft) return false;
  if (params.parent_id && ticket.parent_id !== params.parent_id) return false;
  if (params.shorthand && ticket.shorthand !== params.shorthand) return false;
  if (params.status && ticket.status_name !== params.status) return false;
  if (params.tag?.length && !params.tag.every((tagName) => ticket.tag_names.includes(tagName))) return false;
  return true;
};

export const createPlannerTicketApi = (request: RequestFn = createPlannerRequest()) => {
  const listCollection = (projectId: string, collection: string) =>
    request<ExtensionCollectionResponse>(collectionPath(projectId, collection));

  const list = async (params: ListPlannerTicketsParams) => {
    const [ticketRows, statusRows] = await Promise.all([
      listCollection(params.project_id, "tickets"),
      listCollection(params.project_id, "statuses"),
    ]);
    const statusNameById = toStatusNameById(statusRows.items);

    return ticketRows.items
      .map(toStoredTicket)
      .map((ticket) => toTicketListItem(ticket, statusNameById))
      .filter((ticket) => matchesFilters(ticket, params));
  };

  const get = async (projectId: string, ticketId: string) => {
    const ticketRows = await listCollection(projectId, "tickets");
    const ticket = ticketRows.items
      .map(toStoredTicket)
      .find((item) => item.id === ticketId || item.shorthand === ticketId);
    return ticket ? toTicketDetail(ticket) : null;
  };

  return { list, get };
};

export const listPlannerTickets = (params: ListPlannerTicketsParams) => createPlannerTicketApi().list(params);
export const getPlannerTicket = (projectId: string, ticketId: string) =>
  createPlannerTicketApi().get(projectId, ticketId);
