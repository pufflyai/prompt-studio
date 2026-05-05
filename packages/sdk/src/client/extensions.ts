import type { CommandExecuteRequest, CommandExecuteResponse } from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type ExtensionClient = {
  execute(commandId: string, request: CommandExecuteRequest): Promise<CommandExecuteResponse>;
};

export const createExtensionClient = (request: RequestFn): ExtensionClient => ({
  execute: (commandId, input) => {
    const { projectId, ...body } = input;
    return request(`/v1/projects/${projectId}/extensions/commands/${encodeURIComponent(commandId)}/execute`, {
      method: "POST",
      body,
    });
  },
});
