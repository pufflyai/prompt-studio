import { apiRequest } from "@/lib/api";

export const archiveWorkspace = async (workspaceId: string) => {
  await apiRequest(`/v1/workspaces/${workspaceId}/archive`, { method: "POST" });
};

export const deleteWorkspace = async (workspaceId: string) => {
  await apiRequest(`/v1/workspaces/${workspaceId}`, { method: "DELETE" });
};
