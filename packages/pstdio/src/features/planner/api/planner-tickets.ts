import { createRequest, type RequestFn } from "@pstdio/sdk/client";
import type { FileRecord, Status, Tag, TicketDetail, TicketListItem } from "@pstdio/sdk/resources";
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
  files?: unknown;
};

type StoredStatus = {
  id?: string;
  name?: string;
  color?: string;
  sortOrder?: number;
  isDefault?: boolean;
};

type StoredTagOption = {
  id?: string;
  tagId?: string;
  name?: string;
  color?: string;
  icon?: string | null;
  description?: string | null;
  sortOrder?: number;
};

type StoredTag = {
  id?: string;
  name?: string;
  type?: string;
};

type StoredFile = {
  id?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string | null;
  relativePath?: string;
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

const toTagNameById = (rows: ExtensionCollectionRow[]) => {
  const entries: [string, string][] = [];

  for (const row of rows) {
    const option = asRecord(row.value_json) as StoredTagOption;
    const id = asString(option.id, row.item_id);
    const name = asString(option.name);
    if (id && name) entries.push([id, name]);
  }

  return new Map(entries);
};

const toPlannerStatus = (projectId: string, row: ExtensionCollectionRow, index: number): Status => {
  const status = asRecord(row.value_json) as StoredStatus;
  const timestamp = new Date(0).toISOString();

  return {
    id: asString(status.id, row.item_id),
    project_id: projectId,
    name: asString(status.name, row.item_id),
    color: asString(status.color, "gray"),
    sort_order: typeof status.sortOrder === "number" ? status.sortOrder : index + 1,
    is_default: asBoolean(status.isDefault),
    can_create: true,
    can_drag_in: true,
    can_drag_out: true,
    column_actions: [],
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  } satisfies Status;
};

const toPlannerTags = (projectId: string, tagRows: ExtensionCollectionRow[], optionRows: ExtensionCollectionRow[]) => {
  const timestamp = new Date(0).toISOString();
  const options = optionRows.map((row, index) => {
    const option = asRecord(row.value_json) as StoredTagOption;
    return {
      tagId: asString(option.tagId),
      option: {
        id: asString(option.id, row.item_id),
        name: asString(option.name, row.item_id),
        color: asString(option.color, "gray"),
        icon: (option.icon as string | null | undefined) ?? null,
        description: (option.description as string | null | undefined) ?? null,
        sort_order: typeof option.sortOrder === "number" ? option.sortOrder : index + 1,
      },
    };
  });

  return tagRows.map((row) => {
    const tag = asRecord(row.value_json) as StoredTag;
    const id = asString(tag.id, row.item_id);
    return {
      id,
      project_id: projectId,
      name: asString(tag.name, id),
      type: asString(tag.type, "single_select"),
      options: options.filter((candidate) => candidate.tagId === id).map((candidate) => candidate.option),
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    } satisfies Tag;
  });
};

const toTicketListItem = (
  ticket: StoredTicket,
  statusNameById: Map<string, string>,
  tagNameById: Map<string, string>,
) => {
  const id = asString(ticket.id, asString(ticket.shorthand));
  const statusId = (ticket.statusId as string | null | undefined) ?? null;
  const tagIds = tagNamesOf(ticket);

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
    tag_ids: tagIds,
    tag_names: tagIds.map((tagId) => tagNameById.get(tagId) ?? tagId),
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

const fileRowsOf = (ticket: StoredTicket) =>
  Array.isArray(ticket.files)
    ? ticket.files.map((value) => asRecord(value) as StoredFile).filter((file) => asString(file.fileName).length > 0)
    : [];

const toFileRecord = (projectId: string, ticket: StoredTicket, file: StoredFile): FileRecord => {
  const timestamp = asString(ticket.updatedAt, asString(ticket.createdAt, new Date(0).toISOString()));

  return {
    id: asString(file.fileId, asString(file.id, asString(file.fileName))),
    project_id: projectId,
    file_name: asString(file.relativePath, asString(file.fileName)),
    file_kind: "ticket_file",
    storage_path: `files://${asString(file.fileId, asString(file.id, asString(file.fileName)))}`,
    mime_type: (file.mimeType as string | null | undefined) ?? null,
    size_bytes: 0,
    hash: null,
    created_at: timestamp,
    updated_at: timestamp,
  } satisfies FileRecord;
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
    const [ticketRows, statusRows, tagOptionRows] = await Promise.all([
      listCollection(params.project_id, "tickets"),
      listCollection(params.project_id, "statuses"),
      listCollection(params.project_id, "tag_options"),
    ]);
    const statusNameById = toStatusNameById(statusRows.items);
    const tagNameById = toTagNameById(tagOptionRows.items);

    return ticketRows.items
      .map(toStoredTicket)
      .map((ticket) => toTicketListItem(ticket, statusNameById, tagNameById))
      .filter((ticket) => matchesFilters(ticket, params));
  };

  const get = async (projectId: string, ticketId: string) => {
    const ticketRows = await listCollection(projectId, "tickets");
    const ticket = ticketRows.items
      .map(toStoredTicket)
      .find((item) => item.id === ticketId || item.shorthand === ticketId);
    return ticket ? toTicketDetail(ticket) : null;
  };

  const listStatuses = async (projectId: string) => {
    const rows = await listCollection(projectId, "statuses");
    return rows.items.map((row, index) => toPlannerStatus(projectId, row, index));
  };

  const listTags = async (projectId: string) => {
    const [tagRows, optionRows] = await Promise.all([
      listCollection(projectId, "tags"),
      listCollection(projectId, "tag_options"),
    ]);
    return toPlannerTags(projectId, tagRows.items, optionRows.items);
  };

  const listFiles = async (projectId: string, ticketId: string) => {
    const ticketRows = await listCollection(projectId, "tickets");
    const ticket = ticketRows.items
      .map(toStoredTicket)
      .find((item) => item.id === ticketId || item.shorthand === ticketId);
    return ticket ? fileRowsOf(ticket).map((file) => toFileRecord(projectId, ticket, file)) : [];
  };

  return { list, get, listStatuses, listTags, listFiles };
};

export const listPlannerTickets = (params: ListPlannerTicketsParams) => createPlannerTicketApi().list(params);
export const getPlannerTicket = (projectId: string, ticketId: string) =>
  createPlannerTicketApi().get(projectId, ticketId);
export const listPlannerStatuses = (projectId: string) => createPlannerTicketApi().listStatuses(projectId);
export const listPlannerTags = (projectId: string) => createPlannerTicketApi().listTags(projectId);
export const listPlannerTicketFiles = (projectId: string, ticketId: string) =>
  createPlannerTicketApi().listFiles(projectId, ticketId);
