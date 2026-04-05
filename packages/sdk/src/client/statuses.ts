import type { CreateStatusInput } from "../api/statuses";
import type { Status } from "../resources";
import type { RequestFn } from "./request";

export type StatusClient = {
  list(projectId: string): Promise<Status[]>;
  create(projectId: string, input: CreateStatusInput): Promise<Status>;
  delete(projectId: string, statusId: string): Promise<void>;
};

export const createStatusClient = (request: RequestFn): StatusClient => ({
  list: (projectId) => request(`/v1/projects/${projectId}/statuses`),
  create: (projectId, input) => request(`/v1/projects/${projectId}/statuses`, { method: "POST", body: input }),
  delete: (projectId, statusId) => request(`/v1/projects/${projectId}/statuses/${statusId}`, { method: "DELETE" }),
});
