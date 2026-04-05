import type { ActionResult, ExecuteActionInput } from "../api/actions";
import type { ActionDescriptor, TargetType } from "../plugins/types";
import type { RequestFn } from "./request";

export type ActionClient = {
  list(projectId: string, targetType?: TargetType): Promise<ActionDescriptor[]>;
  execute(projectId: string, actionKey: string, input: ExecuteActionInput): Promise<ActionResult>;
};

export const createActionClient = (request: RequestFn): ActionClient => ({
  list: (projectId, targetType) =>
    request(
      targetType ? `/v1/projects/${projectId}/actions?targetType=${targetType}` : `/v1/projects/${projectId}/actions`,
    ),
  execute: (projectId, actionKey, input) =>
    request(`/v1/projects/${projectId}/actions/${encodeURIComponent(actionKey)}/execute`, {
      method: "POST",
      body: input,
    }),
});
