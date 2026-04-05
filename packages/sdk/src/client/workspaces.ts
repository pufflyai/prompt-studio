import type {
  CreateWorkspaceInput,
  RemoveWorktreeResponse,
  UpdateAttemptStatusInput,
  UpdateAttemptStatusResponse,
} from "pstdio-api-contracts";
import type { Workspace, WorkspaceListItem } from "../resources";
import type { RequestFn } from "./request";

export type WorkspaceClient = {
  list(projectId: string): Promise<WorkspaceListItem[]>;
  getByShorthand(projectId: string, shorthand: string): Promise<Workspace>;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  updateAttemptStatus(workspaceId: string, input: UpdateAttemptStatusInput): Promise<UpdateAttemptStatusResponse>;
  removeWorktree(workspaceId: string): Promise<RemoveWorktreeResponse>;
  delete(workspaceId: string): Promise<void>;
};

export const createWorkspaceClient = (request: RequestFn): WorkspaceClient => ({
  list: (projectId) => request(`/v1/workspaces?project_id=${projectId}`),
  getByShorthand: (projectId, shorthand) =>
    request(
      `/v1/workspaces/by-shorthand?project_id=${encodeURIComponent(projectId)}&shorthand=${encodeURIComponent(shorthand)}`,
    ),
  create: (input) => request("/v1/workspaces", { method: "POST", body: input }),
  updateAttemptStatus: (workspaceId, input) =>
    request(`/v1/workspaces/${workspaceId}/attempt-status`, { method: "PATCH", body: input }),
  removeWorktree: (workspaceId) => request(`/v1/workspaces/${workspaceId}/remove-worktree`, { method: "POST" }),
  delete: (workspaceId) => request(`/v1/workspaces/${workspaceId}`, { method: "DELETE" }),
});
