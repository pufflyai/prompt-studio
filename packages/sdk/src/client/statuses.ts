import type { AttemptStatus, CreateAttemptStatusInput, CreateStatusInput } from "pstdio-api-contracts";
import type { Status } from "../resources";
import { executePlannerCommand, listPlannerCollection, toPlannerStatus, toPlannerStatusFromValue } from "./planner";
import type { RequestFn } from "./request";

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

export const createStatusClient = (request: RequestFn): StatusClient => ({
  list: async (projectId) =>
    (await listPlannerCollection(request, projectId, "statuses")).map((row, index) =>
      toPlannerStatus(projectId, row, index),
    ),
  create: async (projectId, input) =>
    toPlannerStatusFromValue(projectId, await executePlannerCommand(request, projectId, "createStatus", input)),
  update: async (projectId, statusId, input) =>
    toPlannerStatusFromValue(
      projectId,
      await executePlannerCommand(request, projectId, "updateStatus", { status_id: statusId, ...input }),
    ),
  setDefault: async (projectId, statusId) => {
    await executePlannerCommand(request, projectId, "setDefaultStatus", { status_id: statusId });
  },
  delete: async (projectId, statusId) => {
    await executePlannerCommand(request, projectId, "deleteStatus", { status_id: statusId });
  },
  listAttemptStatuses: (projectId) => request(`/v1/projects/${projectId}/attempt-statuses`),
  createAttemptStatus: (projectId, input) =>
    request(`/v1/projects/${projectId}/attempt-statuses`, { method: "POST", body: input }),
  updateAttemptStatus: (projectId, statusId, input) =>
    request(`/v1/projects/${projectId}/attempt-statuses/${statusId}`, { method: "PATCH", body: input }),
  deleteAttemptStatus: (projectId, statusId) =>
    request(`/v1/projects/${projectId}/attempt-statuses/${statusId}`, { method: "DELETE" }),
});
