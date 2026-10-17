import type {
  ExtensionBlobRef,
  ExtensionSettingValueRecord,
  WebviewFilesListParams,
  WebviewFilesUploadParams,
  WebviewPreferencesGetParams,
  WebviewPreferencesSetParams,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export const projectExtensionPath = (projectId: string, instanceId: string) =>
  `/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(instanceId)}`;
const installedPath = (installName: string) => `/v1/extensions/installed/${encodeURIComponent(installName)}`;
const scopeQuery = (scope: WebviewFilesListParams["scope"]) => {
  if (!scope) return "";
  const query = new URLSearchParams({ scope_type: scope.type });
  if ("id" in scope && scope.id) query.set("scope_id", scope.id);
  return `?${query}`;
};
const preferencePath = (base: string, name: string, scope?: WebviewPreferencesGetParams["scope"]) => {
  const query = new URLSearchParams();
  if (scope) {
    query.set("scope", scope.scope);
    if (scope.scopeId !== undefined) query.set("scopeId", scope.scopeId);
  }
  return `${base}/preferences/${encodeURIComponent(name)}?${query}`;
};
const settingsAt = (request: RequestFn, base: string) => ({
  all: () => request<{ settings: ExtensionSettingValueRecord[] }>(`${base}/settings`),
  get: (key: string) => request<ExtensionSettingValueRecord>(`${base}/settings/${encodeURIComponent(key)}`),
  set: (key: string, value: unknown) =>
    request<ExtensionSettingValueRecord>(`${base}/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: { value },
    }),
  delete: (key: string) => request<void>(`${base}/settings/${encodeURIComponent(key)}`, { method: "DELETE" }),
});
const preferencesAt = (request: RequestFn, base: string) => ({
  get: (name: string, scope?: WebviewPreferencesGetParams["scope"]) =>
    request<{ value?: WebviewPreferencesSetParams["value"] }>(preferencePath(base, name, scope)),
  set: (name: string, value: WebviewPreferencesSetParams["value"], scope?: WebviewPreferencesGetParams["scope"]) =>
    request<{ name: string; value: WebviewPreferencesSetParams["value"] }>(preferencePath(base, name, scope), {
      method: "PUT",
      body: { value },
    }),
});

export const createExtensionControlsClient = (request: RequestFn) => ({
  projectSettings: {
    all: (projectId: string, instanceId: string) =>
      settingsAt(request, projectExtensionPath(projectId, instanceId)).all(),
    get: (projectId: string, instanceId: string, key: string) =>
      settingsAt(request, projectExtensionPath(projectId, instanceId)).get(key),
    set: (projectId: string, instanceId: string, key: string, value: unknown) =>
      settingsAt(request, projectExtensionPath(projectId, instanceId)).set(key, value),
    delete: (projectId: string, instanceId: string, key: string) =>
      settingsAt(request, projectExtensionPath(projectId, instanceId)).delete(key),
  },
  installedSettings: {
    all: (installName: string) => settingsAt(request, installedPath(installName)).all(),
    get: (installName: string, key: string) => settingsAt(request, installedPath(installName)).get(key),
    set: (installName: string, key: string, value: unknown) =>
      settingsAt(request, installedPath(installName)).set(key, value),
    delete: (installName: string, key: string) => settingsAt(request, installedPath(installName)).delete(key),
  },
  projectPreferences: {
    get: (projectId: string, instanceId: string, name: string, scope?: WebviewPreferencesGetParams["scope"]) =>
      preferencesAt(request, projectExtensionPath(projectId, instanceId)).get(name, scope),
    set: (
      projectId: string,
      instanceId: string,
      name: string,
      value: WebviewPreferencesSetParams["value"],
      scope?: WebviewPreferencesGetParams["scope"],
    ) => preferencesAt(request, projectExtensionPath(projectId, instanceId)).set(name, value, scope),
  },
  installedPreferences: {
    get: (installName: string, name: string, scope?: WebviewPreferencesGetParams["scope"]) =>
      preferencesAt(request, installedPath(installName)).get(name, scope),
    set: (
      installName: string,
      name: string,
      value: WebviewPreferencesSetParams["value"],
      scope?: WebviewPreferencesGetParams["scope"],
    ) => preferencesAt(request, installedPath(installName)).set(name, value, scope),
  },
  files: {
    upload: (projectId: string, instanceId: string, input: WebviewFilesUploadParams) =>
      request<ExtensionBlobRef>(`${projectExtensionPath(projectId, instanceId)}/files${scopeQuery(input.scope)}`, {
        method: "POST",
        body: input.data,
        headers: {
          "content-type": input.mimeType ?? "application/octet-stream",
          "x-file-name": encodeURIComponent(input.name),
        },
      }),
    list: (projectId: string, instanceId: string, input: WebviewFilesListParams = {}) =>
      request<{ files: ExtensionBlobRef[] }>(
        `${projectExtensionPath(projectId, instanceId)}/files${scopeQuery(input.scope)}`,
      ),
    delete: (projectId: string, instanceId: string, id: string) =>
      request<void>(`${projectExtensionPath(projectId, instanceId)}/files/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },
});
