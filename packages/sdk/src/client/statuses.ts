import type { AttemptStatus, CreateAttemptStatusInput, CreateStatusInput } from "pstdio-api-contracts";
import type { Status } from "../resources";
import type { RequestFn } from "./request";

/** @deprecated Legacy core ticket status client. Ticket statuses are owned by the pstdio tickets extension. */
export type StatusClient = {
  list(projectId: string): Promise<Status[]>;
  create(projectId: string, input: CreateStatusInput): Promise<Status>;
  update(projectId: string, statusId: string, input: { color?: string }): Promise<Status>;
  setDefault(projectId: string, statusId: string): Promise<void>;
  delete(projectId: string, statusId: string): Promise<void>;
  listAttemptStatuses(projectId: string): Promise<AttemptStatus[]>;
  createAttemptStatus(projectId: string, input: CreateAttemptStatusInput): Promise<AttemptStatus>;
  updateAttemptStatus(
    projectId: string,
    statusId: string,
    input: { name?: string; color?: string; sort_order?: number; is_default?: boolean },
  ): Promise<AttemptStatus>;
  deleteAttemptStatus(projectId: string, statusId: string): Promise<void>;
};

/** @deprecated Legacy core ticket status client. Ticket statuses are owned by the pstdio tickets extension. */
export const createStatusClient = (request: RequestFn): StatusClient => ({
  list: (projectId) => request(`/v1/projects/${projectId}/statuses`),
  create: (projectId, input) => request(`/v1/projects/${projectId}/statuses`, { method: "POST", body: input }),
  update: (projectId, statusId, input) =>
    request(`/v1/projects/${projectId}/statuses/${statusId}`, { method: "PATCH", body: input }),
  setDefault: (projectId, statusId) =>
    request(`/v1/projects/${projectId}/statuses/${statusId}/set-default`, { method: "PATCH" }),
  delete: (projectId, statusId) => request(`/v1/projects/${projectId}/statuses/${statusId}`, { method: "DELETE" }),
  listAttemptStatuses: (projectId) => request(`/v1/projects/${projectId}/attempt-statuses`),
  createAttemptStatus: (projectId, input) =>
    request(`/v1/projects/${projectId}/attempt-statuses`, { method: "POST", body: input }),
  updateAttemptStatus: (projectId, statusId, input) =>
    request(`/v1/projects/${projectId}/attempt-statuses/${statusId}`, { method: "PATCH", body: input }),
  deleteAttemptStatus: (projectId, statusId) =>
    request(`/v1/projects/${projectId}/attempt-statuses/${statusId}`, { method: "DELETE" }),
});
