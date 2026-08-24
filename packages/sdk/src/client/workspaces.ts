import type {
  CreateWorkspaceInput,
  ListWorkspaceActivityInput,
  ListWorkspaceActivityResponse,
  ListWorkspaceFilesInput,
  MoveWorkspaceEntryInput,
  RemoveWorktreeResponse,
  RenameWorkspaceInput,
  WorkspaceFileContent,
  WorkspaceFileEntry,
  WorkspaceFilesResponse,
  WriteWorkspaceFileInput,
} from "pstdio-api-contracts";
import type { Workspace, WorkspaceListItem } from "../resources";
import type { RequestFn } from "./request";

export type WorkspaceClient = {
  list(projectId: string): Promise<WorkspaceListItem[]>;
  getByShorthand(projectId: string, shorthand: string): Promise<Workspace>;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  rename(workspaceId: string, input: RenameWorkspaceInput): Promise<Workspace>;
  listActivity(workspaceId: string, input?: ListWorkspaceActivityInput): Promise<ListWorkspaceActivityResponse>;
  listFiles(workspaceId: string, input?: ListWorkspaceFilesInput): Promise<WorkspaceFilesResponse>;
  createDirectory(workspaceId: string, path: string): Promise<WorkspaceFileEntry>;
  createFile(workspaceId: string, path: string, input: WriteWorkspaceFileInput): Promise<WorkspaceFileContent>;
  readFile(workspaceId: string, path: string): Promise<WorkspaceFileContent>;
  writeFile(workspaceId: string, path: string, input: WriteWorkspaceFileInput): Promise<WorkspaceFileContent>;
  moveEntry(workspaceId: string, path: string, destinationPath: string): Promise<void>;
  deleteEntry(workspaceId: string, path: string): Promise<void>;
  removeWorktree(workspaceId: string): Promise<RemoveWorktreeResponse>;
  delete(workspaceId: string): Promise<void>;
};

export const createWorkspaceClient = (request: RequestFn): WorkspaceClient => ({
  listFiles: (workspaceId, input = {}) => {
    const params = new URLSearchParams();
    if (input.path !== undefined) params.append("path", input.path);
    if (input.query !== undefined) params.append("query", input.query);
    if (input.limit !== undefined) params.append("limit", String(input.limit));
    const query = params.toString();
    return request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/files${query ? `?${query}` : ""}`);
  },
  readFile: (workspaceId, path) => {
    const params = new URLSearchParams({ path });
    return request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/file?${params.toString()}`);
  },
  createDirectory: (workspaceId, path) => {
    const params = new URLSearchParams({ path });
    return request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/directory?${params.toString()}`, {
      method: "POST",
    });
  },
  createFile: (workspaceId, path, input) => {
    const params = new URLSearchParams({ path });
    return request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/file?${params.toString()}`, {
      method: "POST",
      body: input,
    });
  },
  writeFile: (workspaceId, path, input) => {
    const params = new URLSearchParams({ path });
    return request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/file?${params.toString()}`, {
      method: "PUT",
      body: input,
    });
  },
  moveEntry: (workspaceId, path, destinationPath) => {
    const params = new URLSearchParams({ path });
    const body: MoveWorkspaceEntryInput = { destination_path: destinationPath };
    return request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/entry?${params.toString()}`, {
      method: "PATCH",
      body,
    });
  },
  deleteEntry: (workspaceId, path) => {
    const params = new URLSearchParams({ path });
    return request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/entry?${params.toString()}`, {
      method: "DELETE",
    });
  },
  listActivity: (workspaceId, input = {}) => {
    const params = new URLSearchParams();
    if (input.event_type) params.append("event_type", input.event_type);
    if (input.from) params.append("from", input.from);
    if (input.to) params.append("to", input.to);
    if (input.cursor) params.append("cursor", input.cursor);
    if (input.limit !== undefined) params.append("limit", String(input.limit));
    const query = params.toString();
    return request(`/v1/workspaces/${workspaceId}/activity${query ? `?${query}` : ""}`);
  },
  list: (projectId) => request(`/v1/workspaces?project_id=${projectId}`),
  getByShorthand: (projectId, shorthand) =>
    request(
      `/v1/workspaces/by-shorthand?project_id=${encodeURIComponent(projectId)}&shorthand=${encodeURIComponent(shorthand)}`,
    ),
  create: (input) => request("/v1/workspaces", { method: "POST", body: input }),
  rename: (workspaceId, input) => request(`/v1/workspaces/${workspaceId}`, { method: "PATCH", body: input }),
  removeWorktree: (workspaceId) => request(`/v1/workspaces/${workspaceId}/remove-worktree`, { method: "POST" }),
  delete: (workspaceId) => request(`/v1/workspaces/${workspaceId}`, { method: "DELETE" }),
});
