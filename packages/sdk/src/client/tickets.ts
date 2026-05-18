import type {
  CreateTicketAttemptInput,
  CreateTicketInput,
  ListProjectActivityForTicketsInput,
  ListTicketActivityInput,
  ListTicketActivityResponse,
  ListTicketsInput,
  TicketAttemptResponse,
  UpdateTicketInput,
  UpdateWhenAttemptStatusInput,
  UpdateWhenAttemptStatusResponse,
  UploadTicketFileInput,
} from "../api/tickets";
import type { Ticket, TicketDetail, TicketFile, TicketListItem } from "../resources";
import { type ClientOptions, PstdioApiError, type RequestFn } from "./request";

export type TicketClient = {
  list(projectId: string, input?: ListTicketsInput): Promise<TicketListItem[]>;
  get(ticketId: string): Promise<TicketDetail>;
  create(input: CreateTicketInput): Promise<Ticket>;
  update(ticketId: string, input: UpdateTicketInput): Promise<Ticket>;
  delete(ticketId: string): Promise<void>;
  createAttempt(ticketId: string, input: CreateTicketAttemptInput): Promise<TicketAttemptResponse>;
  listActivity(ticketId: string, input?: ListTicketActivityInput): Promise<ListTicketActivityResponse>;
  listProjectActivity(
    projectId: string,
    input?: ListProjectActivityForTicketsInput,
  ): Promise<ListTicketActivityResponse>;
  updateWhenAttemptStatus(
    ticketId: string,
    input: UpdateWhenAttemptStatusInput,
  ): Promise<UpdateWhenAttemptStatusResponse>;
  listFiles(ticketId: string): Promise<TicketFile[]>;
  getFileContent(
    ticketId: string,
    fileId: string,
    options?: { cache?: RequestCache; signal?: AbortSignal },
  ): Promise<Uint8Array>;
  uploadFile(ticketId: string, input: UploadTicketFileInput): Promise<TicketFile>;
  deleteFile(ticketId: string, fileId: string): Promise<void>;
};

const resolveBaseUrl = (options: ClientOptions) =>
  options.baseUrl ??
  (typeof process !== "undefined" ? process.env.PSTDIO_API_URL : undefined) ??
  "http://localhost:19840";

const readErrorMessage = async (response: Response) => {
  const errorBody: unknown = await response.json().catch(() => null);
  if (errorBody && typeof errorBody === "object" && errorBody !== null && "error" in errorBody) {
    return String((errorBody as { error: string }).error);
  }

  return `Request failed: ${response.status}`;
};

const buildTicketsQuery = (projectId: string, input: ListTicketsInput = {}) => {
  const params = new URLSearchParams({ project_id: projectId });

  if (input.status) params.append("status", input.status);

  if (Array.isArray(input.tag)) {
    for (const tag of input.tag) params.append("tag", tag);
  } else if (input.tag) {
    params.append("tag", input.tag);
  }

  if (input.archived !== undefined) params.append("archived", String(input.archived));
  if (input.draft !== undefined) params.append("draft", String(input.draft));
  if (input.parent_id) params.append("parent_id", input.parent_id);
  if (input.shorthand) params.append("shorthand", input.shorthand);
  if (input.search) params.append("search", input.search);

  return params.toString();
};

const buildActivityQuery = (
  input: {
    event_type?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
    resource_type?: string;
  } = {},
) => {
  const params = new URLSearchParams();
  if (input.resource_type) params.append("resource_type", input.resource_type);
  if (input.event_type) params.append("event_type", input.event_type);
  if (input.from) params.append("from", input.from);
  if (input.to) params.append("to", input.to);
  if (input.cursor) params.append("cursor", input.cursor);
  if (input.limit !== undefined) params.append("limit", String(input.limit));
  return params.toString();
};

export const createTicketClient = (request: RequestFn, options: ClientOptions = {}): TicketClient => ({
  list: (projectId, input) => request(`/v1/tickets?${buildTicketsQuery(projectId, input)}`),
  get: (ticketId) => request(`/v1/tickets/${ticketId}`),
  create: (input) => request("/v1/tickets", { method: "POST", body: input }),
  update: (ticketId, input) => request(`/v1/tickets/${ticketId}`, { method: "PATCH", body: input }),
  delete: (ticketId) => request(`/v1/tickets/${ticketId}`, { method: "DELETE" }),
  createAttempt: (ticketId, input) => request(`/v1/tickets/${ticketId}/attempts`, { method: "POST", body: input }),
  listActivity: (ticketId, input) => {
    const query = buildActivityQuery(input);
    return request(`/v1/tickets/${ticketId}/activity${query ? `?${query}` : ""}`);
  },
  listProjectActivity: (projectId, input) => {
    const query = buildActivityQuery(input);
    return request(`/v1/projects/${projectId}/activity${query ? `?${query}` : ""}`);
  },
  updateWhenAttemptStatus: (ticketId, input) =>
    request(`/v1/tickets/${ticketId}/update-when-attempt-status`, { method: "POST", body: input }),
  listFiles: (ticketId) => request(`/v1/tickets/${ticketId}/files`),
  getFileContent: async (ticketId, fileId, requestOptions = {}) => {
    const baseUrl = resolveBaseUrl(options);
    const fetchFn = options.fetch ?? globalThis.fetch;
    const headers: Record<string, string> = {};
    if (options.token) headers.authorization = `Bearer ${options.token}`;

    const response = await fetchFn(
      `${baseUrl}/v1/tickets/${encodeURIComponent(ticketId)}/files/${encodeURIComponent(fileId)}/content`,
      { cache: requestOptions.cache, headers, signal: requestOptions.signal },
    );

    if (!response.ok) {
      throw new PstdioApiError(await readErrorMessage(response), response.status);
    }

    return new Uint8Array(await response.arrayBuffer());
  },
  uploadFile: (ticketId, input) => request(`/v1/tickets/${ticketId}/files`, { method: "POST", body: input }),
  deleteFile: (ticketId, fileId) => request(`/v1/tickets/${ticketId}/files/${fileId}`, { method: "DELETE" }),
});
