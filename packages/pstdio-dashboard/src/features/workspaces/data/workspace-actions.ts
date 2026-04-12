import { apiRequest } from "@/lib/api";

export const deleteWorkspace = async (workspaceId: string) => {
  await apiRequest(`/v1/workspaces/${workspaceId}`, { method: "DELETE" });
};
