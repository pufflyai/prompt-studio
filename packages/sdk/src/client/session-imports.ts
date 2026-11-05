import type {
  SessionImportErrors,
  SessionImportJob,
  SessionImportPreview,
  SessionImportSource,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export const createSessionImportsClient = (request: RequestFn) => ({
  preview: (input: SessionImportSource) =>
    request<SessionImportPreview>("/v1/session-imports/preview", { method: "POST", body: input }),
  start: (input: SessionImportSource) =>
    request<SessionImportJob>("/v1/session-imports", { method: "POST", body: input }),
  get: (id: string) => request<SessionImportJob>(`/v1/session-imports/${encodeURIComponent(id)}`),
  pause: (id: string) =>
    request<SessionImportJob>(`/v1/session-imports/${encodeURIComponent(id)}/pause`, { method: "POST" }),
  resume: (id: string) =>
    request<SessionImportJob>(`/v1/session-imports/${encodeURIComponent(id)}/resume`, { method: "POST" }),
  errors: (id: string, options: { offset?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (options.offset !== undefined) query.set("offset", String(options.offset));
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    return request<SessionImportErrors>(`/v1/session-imports/${encodeURIComponent(id)}/errors?${query}`);
  },
});
