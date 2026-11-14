import type {
  ActivityPage,
  CreateWorkspaceInput,
  ListWorkspaceActivityInput,
  ListWorkspaceActivityResponse,
  ListWorkspaceFilesInput,
  Page,
  PageQuery,
  RemoveWorktreeResponse,
  RenameWorkspaceInput,
  UpdateWorkspaceCapacityInput,
  WorkspaceCapacity,
  WorkspaceFileContent,
  WorkspaceFileEntry,
  WorkspaceFilesResponse,
  WorkspaceProviderDescriptor,
  WorkspaceQuery,
  WorkspaceResolvedEntry,
  WriteWorkspaceFileInput,
} from "pstdio-api-contracts";
import type { ExtensionWorkspace, ExtensionWorkspaceCreateInput } from "pstdio-api-contracts/extension-kernel";
import type { Workspace, WorkspaceListItem } from "../resources";
import { pageQuery } from "./page-query";
import type { RequestFn } from "./request";
import type { createSessionStreamTransport } from "./session-stream";
import { type WorkspaceDiffWatchInput, watchWorkspaceDiff } from "./workspace-diff-stream";
import { createWorkspaceDiffClient } from "./workspace-diffs";

export type WorkspaceClient = ReturnType<typeof createWorkspaceDiffClient> & {
  /** Observe external file and Git changes while a local diff is presented. */
  watchDiff(workspaceId: string, input: WorkspaceDiffWatchInput): Promise<void>;
  /** Resolve a protected existing local entry for platform integrations. */
  resolveEntry(workspaceId: string, path: string): Promise<WorkspaceResolvedEntry>;
  getCapacity(): Promise<WorkspaceCapacity>;
  updateCapacity(input: UpdateWorkspaceCapacityInput): Promise<WorkspaceCapacity>;
  queryProviders(
    projectId: string,
    input?: PageQuery,
    options?: { signal?: AbortSignal },
  ): Promise<Page<WorkspaceProviderDescriptor>>;
  /** @deprecated Use queryProviders for bounded pages. */
  listProviders(projectId: string, options?: { signal?: AbortSignal }): Promise<WorkspaceProviderDescriptor[]>;
  query(projectId: string, input?: WorkspaceQuery): Promise<Page<WorkspaceListItem & ExtensionWorkspace>>;
  /** @deprecated Use query to read one bounded page. */
  list(projectId: string): Promise<(WorkspaceListItem & ExtensionWorkspace)[]>;
  getByShorthand(projectId: string, shorthand: string): Promise<Workspace & ExtensionWorkspace>;
  create(
    projectId: string,
    input: Omit<ExtensionWorkspaceCreateInput, "projectId">,
  ): Promise<Workspace & ExtensionWorkspace>;
  /** @deprecated Pass projectId first and use camelCase input. */
  create(
    input: CreateWorkspaceInput | (ExtensionWorkspaceCreateInput & { projectId: string }),
  ): Promise<Workspace & ExtensionWorkspace>;
  rename(workspaceId: string, input: RenameWorkspaceInput): Promise<Workspace & ExtensionWorkspace>;
  /** @deprecated No maintained client caller. Use `GET /v1/workspaces/{id}/activity` for this operation; the convenience method is removed in 0.45. */
  listActivity(
    workspaceId: string,
    input?: ListWorkspaceActivityInput,
  ): Promise<ListWorkspaceActivityResponse & ActivityPage>;
  listFiles(
    workspaceId: string,
    input?: ListWorkspaceFilesInput,
    options?: { signal?: AbortSignal },
  ): Promise<WorkspaceFilesResponse>;
  createDirectory(workspaceId: string, path: string): Promise<WorkspaceFileEntry>;
  createFile(workspaceId: string, path: string, input: WriteWorkspaceFileInput): Promise<WorkspaceFileContent>;
  readFile(workspaceId: string, path: string, options?: { signal?: AbortSignal }): Promise<WorkspaceFileContent>;
  writeFile(workspaceId: string, path: string, input: WriteWorkspaceFileInput): Promise<WorkspaceFileContent>;
  moveEntry(workspaceId: string, path: string, destinationPath: string): Promise<void>;
  deleteEntry(workspaceId: string, path: string): Promise<void>;
  removeWorktree(workspaceId: string): Promise<RemoveWorktreeResponse>;
  /** Forget only a remote missing-provider record without a backing reference or local path. Abandons recovery; remote resources are not deleted. */
  delete(workspaceId: string, options?: { forget?: boolean }): Promise<void>;
};

export const createWorkspaceClient = (
  request: RequestFn,
  streams: ReturnType<typeof createSessionStreamTransport>,
): WorkspaceClient => ({
  watchDiff: (id, input) => watchWorkspaceDiff(streams, id, input),
  ...createWorkspaceDiffClient(request),
  resolveEntry: (workspaceId, path) =>
    request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/entry?${new URLSearchParams({ path })}`),
  getCapacity: () => request("/v1/workspaces/capacity"),
  updateCapacity: (input) => request("/v1/workspaces/capacity", { method: "PATCH", body: input }),
  queryProviders: (projectId, input, options) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/workspace-providers/query${pageQuery(input)}`, options),
  listProviders: (projectId, options) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/workspace-providers`, options),
  listFiles: (workspaceId, input = {}, options) => {
    const params = new URLSearchParams();
    if (input.path !== undefined) params.append("path", input.path);
    if (input.query !== undefined) params.append("query", input.query);
    if (input.limit !== undefined) params.append("limit", String(input.limit));
    const query = params.toString();
    return request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/files${query ? `?${query}` : ""}`, options);
  },
  readFile: (workspaceId, path, options) => {
    const params = new URLSearchParams({ path });
    return request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/file?${params.toString()}`, options);
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
    const body = { destinationPath };
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
    if (input.eventType) params.append("eventType", input.eventType);
    else if (input.event_type) params.append("event_type", input.event_type);
    if (input.from) params.append("from", input.from);
    if (input.to) params.append("to", input.to);
    if (input.cursor) params.append("cursor", input.cursor);
    if (input.limit !== undefined) params.append("limit", String(input.limit));
    const query = params.toString();
    return request(`/v1/workspaces/${workspaceId}/activity${query ? `?${query}` : ""}`);
  },
  query: (projectId, input) => {
    const query = new URLSearchParams(pageQuery(input).replace(/^\?/, ""));
    if (input?.anchors !== undefined) query.set("anchors", JSON.stringify(input.anchors));
    return request(`/v1/projects/${encodeURIComponent(projectId)}/workspaces?${query}`);
  },
  list: (projectId) => request(`/v1/workspaces?projectId=${encodeURIComponent(projectId)}`),
  getByShorthand: (projectId, shorthand) =>
    request(
      `/v1/workspaces/by-shorthand?projectId=${encodeURIComponent(projectId)}&shorthand=${encodeURIComponent(shorthand)}`,
    ),
  create: (
    projectOrInput: string | CreateWorkspaceInput | (ExtensionWorkspaceCreateInput & { projectId: string }),
    input?: Omit<ExtensionWorkspaceCreateInput, "projectId">,
  ) =>
    request("/v1/workspaces", {
      method: "POST",
      body: typeof projectOrInput === "string" ? { ...input, projectId: projectOrInput } : projectOrInput,
    }),
  rename: (workspaceId, input) => request(`/v1/workspaces/${workspaceId}`, { method: "PATCH", body: input }),
  removeWorktree: (workspaceId) => request(`/v1/workspaces/${workspaceId}/remove-worktree`, { method: "POST" }),
  delete: (workspaceId, options) =>
    request(`/v1/workspaces/${encodeURIComponent(workspaceId)}${options?.forget ? "?forget=true" : ""}`, {
      method: "DELETE",
    }),
});
