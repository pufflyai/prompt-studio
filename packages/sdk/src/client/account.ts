import {
  type AccountDevice,
  type AccountLogin,
  type AccountLoginStatus,
  type AccountStatus,
  type CloudProjectCatalog,
  type CloudProjectDeletion,
  type DeleteCloudProjectInput,
  type DeviceCommand,
  type DownloadCloudProjectResult,
  type LocalRemovalPreflight,
  localRemovalConflictSchema,
  type ProjectReturnAction,
  type ProjectSyncStatus,
  type RemoveLocalProjectInput,
  type RemoveLocalProjectResult,
} from "pstdio-api-contracts";
import { PstdioApiError, type RequestFn } from "./request";

export type { AccountDevice, AccountStatus, DeviceLogin } from "pstdio-api-contracts";

type Ok = { ok: boolean };
export type AccountReadIdentity = { accountId: string; managerOrigin: string };
type AccountReadOptions = { signal?: AbortSignal };

export class LocalRemovalConflictError extends PstdioApiError {
  constructor(
    message: string,
    readonly preflight: LocalRemovalPreflight,
  ) {
    super(message, 409, "project_local_removal_discard_required", preflight);
    this.name = "LocalRemovalConflictError";
  }
}

const localRemovalError = (error: unknown) => {
  if (!(error instanceof PstdioApiError) || error.status !== 409) return error;
  const parsed = localRemovalConflictSchema.safeParse({
    code: error.code,
    error: error.message,
    details: error.details,
  });
  return parsed.success ? new LocalRemovalConflictError(parsed.data.error, parsed.data.details) : error;
};

const expectedIdentityQuery = (expected?: AccountReadIdentity | null) => {
  const query = new URLSearchParams(expected === null ? { local: "true" } : expected);
  return query.size ? `?${query.toString()}` : "";
};

export const createAccountClient = (request: RequestFn) => {
  const device = (id: string) => `/v1/account/devices/${encodeURIComponent(id)}`;
  const project = (id: string) => `/v1/account/projects/${encodeURIComponent(id)}`;
  const login = (id: string) => `/v1/account/login/${encodeURIComponent(id)}`;
  return {
    /** Sends an online-only action to one of your devices. Commands are never saved for later delivery. */
    sendDeviceCommand: (projectId: string, deviceId: string, command: DeviceCommand, signal?: AbortSignal) =>
      request<{ status: number; body: unknown }>(
        `${project(projectId)}/devices/${encodeURIComponent(deviceId)}/commands`,
        { method: "POST", body: command, signal },
      ),
    /** Uses the host's account service when no address is supplied. */
    login: (managerOrigin?: string) =>
      request<AccountLogin>("/v1/account/login", { method: "POST", body: { managerOrigin } }),
    loginStatus: (id: string) => request<{ status: AccountLoginStatus }>(login(id)),
    /** Cancels a pending sign-in. A sign-in that already completed stays complete. */
    cancelLogin: (id: string) =>
      request<Ok & { status: Exclude<AccountLoginStatus, "pending"> }>(login(id), { method: "DELETE" }),
    /** Reads known Cloud membership, device presence, and outstanding deletion operations. */
    projectsCatalog: (options?: AccountReadOptions) => request<CloudProjectCatalog>("/v1/account/projects", options),
    /** Inspects current upload certainty and what removing this device's copy would clean up. */
    projectLocalRemoval: (projectId: string, options?: AccountReadOptions) =>
      request<LocalRemovalPreflight>(`${project(projectId)}/local-removal`, options),
    /** Requires explicit discard acknowledgement when a fresh host check finds pending or unknown upload state. */
    removeLocalProject: (projectId: string, input: RemoveLocalProjectInput = {}, options?: AccountReadOptions) =>
      request<RemoveLocalProjectResult>(`${project(projectId)}/remove-local`, {
        ...options,
        method: "POST",
        body: input,
      }).catch((error: unknown) => {
        throw localRemovalError(error);
      }),
    /** Explicitly requests a device copy and returns its current download state. */
    downloadCloudProject: (projectId: string, options?: AccountReadOptions) =>
      request<DownloadCloudProjectResult>(`${project(projectId)}/download`, { ...options, method: "POST" }),
    /** Starts or resumes permanent Cloud deletion. The receipt reports whether cleanup has completed. */
    deleteCloudProject: (projectId: string, input: DeleteCloudProjectInput, options?: AccountReadOptions) =>
      request<CloudProjectDeletion>(`${project(projectId)}/delete-cloud`, { ...options, method: "POST", body: input }),
    /** Reads an authoritative deletion receipt without requiring a device copy. */
    projectDeletionStatus: (projectId: string, options?: AccountReadOptions) =>
      request<CloudProjectDeletion>(`${project(projectId)}/deletion`, options),
    /** An explicit null expectation means signed out; omission preserves unspecified caller authority. */
    projectSyncStatus: (projectId: string, options?: { signal?: AbortSignal; expected?: AccountReadIdentity | null }) =>
      request<ProjectSyncStatus>(`${project(projectId)}/sync${expectedIdentityQuery(options?.expected)}`, {
        signal: options?.signal,
      }),
    retryProjectSyncSource: (projectId: string, sourceId: string) =>
      request<Ok>(`${project(projectId)}/sync/sources/${encodeURIComponent(sourceId)}/retry`, { method: "POST" }),
    /** Retries project discovery, downloads, and activation of its synced extensions immediately. */
    retryProjectSync: (projectId: string) => request<Ok>(`${project(projectId)}/retry`, { method: "POST" }),
    /** Includes account feature grants. `features` is null until discovery or when signed out. */
    status: (options?: { signal?: AbortSignal }) => request<AccountStatus>("/v1/account", options),
    /** `removed` is false when the account service could not be reached; remove the device from another one. */
    logout: () => request<Ok & { removed: boolean }>("/v1/account/logout", { method: "POST" }),
    devices: (options?: { signal?: AbortSignal; expected?: AccountReadIdentity }) =>
      request<AccountDevice[]>(`/v1/account/devices${expectedIdentityQuery(options?.expected)}`, {
        signal: options?.signal,
      }),
    renameDevice: (id: string, name: string) => request<Ok>(`${device(id)}/rename`, { method: "POST", body: { name } }),
    removeDevice: (id: string) => request<Ok>(`${device(id)}/remove`, { method: "POST" }),
    /** Makes a local project a cloud project of the logged-in account. */
    syncProject: (projectId: string) => request<Ok>(project(projectId), { method: "PUT" }),
    /** Stops syncing a cloud project. Every device keeps its local copy. */
    stopProjectSync: (projectId: string) => request<Ok>(project(projectId), { method: "DELETE" }),
    /** Applies or discards a held return, or clears the replaced-changes list, on this device. */
    resolveReturnedChanges: (projectId: string, action: ProjectReturnAction) =>
      request<Ok>(`${project(projectId)}/returned-changes`, { method: "POST", body: { action } }),
  };
};
export type AccountClient = ReturnType<typeof createAccountClient>;
