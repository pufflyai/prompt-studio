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

export const listActions = (_projectId: string, _targetType?: string): Promise<ActionDescriptor[]> =>
  Promise.resolve([]);

export const executeAction = (
  _projectId: string,
  _actionKey: string,
  _input: ExecuteActionInput,
): Promise<ActionResult> =>
  Promise.resolve({ status: "error" as const, message: "Legacy plugin actions have been removed." });
