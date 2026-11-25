import type { DeleteCloudProjectInput, ProjectCopyDevice, RemoveLocalProjectInput } from "@pstdio/sdk/client";
import { apiClient } from "@/features/api-client";

export const readCloudCopyDevice = async () => (await apiClient().account.status()).login;
export const listCloudProjects = (accountId?: string, expectedDevice?: ProjectCopyDevice) =>
  apiClient().account.projectsCatalog({ accountId, expectedDevice });
export const inspectLocalRemoval = (id: string, expectedDevice?: ProjectCopyDevice) =>
  apiClient().account.projectLocalRemoval(id, { expectedDevice });
export const removeLocalProject = (id: string, input: RemoveLocalProjectInput) =>
  apiClient().account.removeLocalProject(id, input);
export const downloadCloudProject = (id: string) => apiClient().account.downloadCloudProject(id);
export const startCloudDeletion = (id: string, input: DeleteCloudProjectInput) =>
  apiClient().account.deleteCloudProject(id, input);
export const readCloudDeletion = (id: string) => apiClient().account.projectDeletionStatus(id);
