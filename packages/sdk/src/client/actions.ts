import type { ActionResult, ExecuteActionInput } from "../api/actions";
import type { ActionDescriptor, TargetType } from "../plugins/types";
import type { RequestFn } from "./request";

export type ActionClient = {
  list(targetType?: TargetType): Promise<ActionDescriptor[]>;
  execute(actionKey: string, input: ExecuteActionInput): Promise<ActionResult>;
};

export const createActionClient = (request: RequestFn): ActionClient => ({
  list: (targetType) => request(targetType ? `/v1/actions?targetType=${targetType}` : "/v1/actions"),
  execute: (actionKey, input) => request(`/v1/actions/${actionKey}/execute`, { method: "POST", body: input }),
});
