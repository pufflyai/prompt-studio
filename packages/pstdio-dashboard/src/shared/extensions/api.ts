import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import { createClient } from "@pstdio/sdk/client";
import type { ScopedQuery } from "@pstdio/sdk/extensions";
import { apiClientOptions, getApiClient } from "@/lib/api";
import { getProjectExtensionQueries } from "./project-extension-queries";

const readCatalog = async <T>(query: ScopedQuery<T>) => {
  const stop = query.subscribe(() => {});
  try {
    return await query.read();
  } finally {
    stop();
  }
};
export const getProjectExtensionMetadata = (projectId: string) =>
  readCatalog(getProjectExtensionQueries(projectId).metadata);
const plannerBoardMove = /^(?:pstdio\.planner|pstdio\.pstdio-planner)\.view\.tickets\.kanban\.onMove$/;
const maximumKeepaliveBytes = 64 * 1024;
let pendingKeepaliveBytes = 0;

const fetchPlannerBoardMove = async (url: RequestInfo | URL, init?: RequestInit) => {
  const bytes = typeof init?.body === "string" ? new TextEncoder().encode(init.body).byteLength : 0;
  if (!bytes || pendingKeepaliveBytes + bytes > maximumKeepaliveBytes) return fetch(url, init);
  pendingKeepaliveBytes += bytes;
  try {
    // Once sent, a card move can finish even when reloading destroys the workbench.
    return await fetch(url, { ...init, keepalive: true });
  } finally {
    pendingKeepaliveBytes -= bytes;
  }
};

export const executeExtensionCommand = (
  projectId: string,
  commandId: string,
  body: Omit<CommandExecuteRequest, "projectId">,
  signal?: AbortSignal,
) => {
  const client = plannerBoardMove.test(commandId)
    ? createClient({ ...apiClientOptions(), fetch: fetchPlannerBoardMove as typeof fetch })
    : getApiClient();
  return client.extensions.execute(commandId, { ...body, projectId }, { signal });
};
// Returns the command's value, or throws its failure.
export const executeExtensionCommandValue = async <T = unknown>(
  projectId: string,
  commandId: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
) => {
  const response = await executeExtensionCommand(projectId, commandId, { params }, signal);
  if (!response.outcome.ok) {
    throw new Error(response.outcome.error?.message ?? response.outcome.reason ?? `Command failed: ${commandId}`);
  }
  return response.outcome.value as T;
};

export const uploadExtensionCommandFile = async (projectId: string, commandId: string, file: File) =>
  getApiClient().extensions.uploadCommandFile(projectId, commandId, {
    name: file.name,
    data: await file.arrayBuffer(),
    mimeType: file.type || undefined,
  });
export const listExtensionArtifacts = (projectId: string, instanceId: string, mountId: string, prefix?: string) =>
  getApiClient().extensions.artifacts.list(projectId, instanceId, mountId, prefix);
export const readExtensionArtifactText = (projectId: string, instanceId: string, mountId: string, path: string) =>
  getApiClient().extensions.artifacts.readText(projectId, instanceId, mountId, path);
export const getExtensionArtifactImageUrl = (
  projectId: string,
  instanceId: string,
  mountId: string,
  path: string,
  webviewId: string,
) => getApiClient().extensions.artifacts.imageUrl(projectId, instanceId, mountId, path, webviewId);
export interface DroppedExtensionFolder {
  name: string;
  force?: boolean;
  /** Each file's name is its path relative to the folder root. */
  files: File[];
}

export const addLocalExtensionFolder = (projectId: string, folder: DroppedExtensionFolder, client = getApiClient()) => {
  const upload = new FormData();
  upload.append("kind", "upload");
  if (folder.force) upload.append("force", "true");
  upload.append("folderName", folder.name);
  upload.append("installName", folder.name);
  for (const file of folder.files) upload.append("files", file, file.name);
  return client.extensions.install(projectId, { upload });
};
