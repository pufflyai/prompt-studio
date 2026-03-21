import { apiRequest } from "@/lib/api";

export type HookEntry = {
  name: string;
  content: string | null;
  blocking: boolean;
};

export const getProjectHooks = async (projectId: string) => apiRequest<HookEntry[]>(`/v1/projects/${projectId}/hooks`);

export const setProjectHook = async (projectId: string, hookName: string, content: string) => {
  await apiRequest(`/v1/projects/${projectId}/hooks/${encodeURIComponent(hookName)}`, {
    method: "PUT",
    body: { content },
  });
};

export const deleteProjectHook = async (projectId: string, hookName: string) => {
  await apiRequest(`/v1/projects/${projectId}/hooks/${encodeURIComponent(hookName)}`, {
    method: "DELETE",
  });
};
