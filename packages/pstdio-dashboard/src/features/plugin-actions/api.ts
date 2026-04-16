import { apiRequest } from "@/lib/api";

export type ActionParamDescriptor = {
  key: string;
  label: string;
  type: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  templateType?: string;
};

export type ActionDescriptor = {
  key: string;
  label: string;
  targetType: string;
  placement: string;
  params?: ActionParamDescriptor[];
};

export type ActionParamValue = string | Record<string, string>;

export type ExecuteActionInput = {
  target_type: string;
  target_id: string;
  params?: Record<string, ActionParamValue>;
};

export type ActionResult =
  | { status: "success"; session_id?: string; message?: string }
  | { status: "error"; message: string };

export const listActions = (projectId: string, targetType?: string) => {
  const query = targetType ? `?targetType=${targetType}` : "";
  return apiRequest<ActionDescriptor[]>(`/v1/projects/${projectId}/actions${query}`);
};

export const executeAction = (projectId: string, actionKey: string, input: ExecuteActionInput) =>
  apiRequest<ActionResult>(`/v1/projects/${projectId}/actions/${encodeURIComponent(actionKey)}/execute`, {
    method: "POST",
    body: input,
  });
