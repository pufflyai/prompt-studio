import { apiRequest } from "@/lib/api";

export interface AttemptStatusResponse {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const createAttemptStatus = async (projectId: string, input: { name: string; color: string }) =>
  apiRequest<AttemptStatusResponse>(`/v1/projects/${projectId}/attempt-statuses`, {
    method: "POST",
    body: input,
  });

export const updateAttemptStatus = async (
  projectId: string,
  id: string,
  input: { name?: string; color?: string; sort_order?: number; is_default?: boolean },
) =>
  apiRequest<AttemptStatusResponse>(`/v1/projects/${projectId}/attempt-statuses/${id}`, {
    method: "PATCH",
    body: input,
  });

export const deleteAttemptStatus = async (projectId: string, id: string) =>
  apiRequest(`/v1/projects/${projectId}/attempt-statuses/${id}`, { method: "DELETE" });
