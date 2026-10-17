import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import { getApiClient } from "@/lib/api";

export const getProjectExtensionMetadata = (projectId: string) => getApiClient().extensions.metadata(projectId);
export const getExtensionContributions = (projectId: string, instanceId: string) =>
  getApiClient().extensions.contributions(projectId, instanceId);
export const getMarketplaceExtensionContributions = (projectId: string, installName: string) =>
  getApiClient().extensions.marketplaceContributions(projectId, installName);
export const getProjectExtensionAppearance = (projectId: string) => getApiClient().extensions.listAppearance(projectId);
export const executeExtensionCommand = (
  projectId: string,
  commandId: string,
  body: Omit<CommandExecuteRequest, "projectId">,
  signal?: AbortSignal,
) => getApiClient().extensions.execute(commandId, { ...body, projectId }, { signal });
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
export const listProjectExtensions = (projectId: string) => getApiClient().extensions.listProject(projectId);
export const installMarketplaceExtension = (projectId: string, installName: string, force = false) =>
  getApiClient().extensions.install(projectId, { source: { kind: "catalog", name: installName }, force });
export interface DroppedExtensionFolder {
  name: string;
  force?: boolean;
  /** Each file's name is its path relative to the folder root. */
  files: File[];
}

export const addLocalExtensionFolder = (projectId: string, folder: DroppedExtensionFolder) => {
  const upload = new FormData();
  upload.append("kind", "upload");
  if (folder.force) upload.append("force", "true");
  upload.append("folderName", folder.name);
  upload.append("installName", folder.name);
  for (const file of folder.files) upload.append("files", file, file.name);
  return getApiClient().extensions.install(projectId, { upload });
};
export const setProjectExtensionEnabled = (projectId: string, instanceId: string, enabled: boolean) =>
  getApiClient().extensions.setEnabled(projectId, instanceId, enabled);
export const setExtensionAutomationEnabled = (
  projectId: string,
  instanceId: string,
  automationId: string,
  enabled: boolean,
) => getApiClient().extensions.setAutomationEnabled(projectId, instanceId, automationId, enabled);
export const reloadProjectExtension = (projectId: string, instanceId: string) =>
  getApiClient().extensions.reload(projectId, instanceId);
export const upgradeProjectExtension = (projectId: string, instanceId: string) =>
  getApiClient().extensions.upgradeProject(projectId, instanceId);
export const uninstallProjectExtension = (projectId: string, instanceId: string, deleteUserData = false) =>
  getApiClient().extensions.uninstall(projectId, instanceId, deleteUserData);
export const listProjectExtensionSettings = (projectId: string, instanceId: string) =>
  getApiClient().extensions.projectSettings.all(projectId, instanceId);
export const getProjectExtensionSetting = (projectId: string, instanceId: string, key: string) =>
  getApiClient().extensions.projectSettings.get(projectId, instanceId, key);
export const updateProjectExtensionSetting = (projectId: string, instanceId: string, key: string, value: unknown) =>
  getApiClient().extensions.projectSettings.set(projectId, instanceId, key, value);
export const deleteProjectExtensionSetting = (projectId: string, instanceId: string, key: string) =>
  getApiClient().extensions.projectSettings.delete(projectId, instanceId, key);
export const listGlobalExtensionSettings = (installName: string) =>
  getApiClient().extensions.installedSettings.all(installName);
export const getGlobalExtensionSetting = (installName: string, key: string) =>
  getApiClient().extensions.installedSettings.get(installName, key);
export const updateGlobalExtensionSetting = (installName: string, key: string, value: unknown) =>
  getApiClient().extensions.installedSettings.set(installName, key, value);
export const deleteGlobalExtensionSetting = (installName: string, key: string) =>
  getApiClient().extensions.installedSettings.delete(installName, key);
