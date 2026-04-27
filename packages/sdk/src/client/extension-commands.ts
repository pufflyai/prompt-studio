import type { ExecuteExtensionCommandInput, ExecuteExtensionCommandResponse } from "../api/extension-commands";
import type { RequestFn } from "./request";

export type ExtensionCommandClient = {
  execute(projectId: string, commandId: string, input: ExecuteExtensionCommandInput): Promise<unknown>;
};

export const createExtensionCommandClient = (request: RequestFn): ExtensionCommandClient => ({
  execute: async (projectId, commandId, input) => {
    const response = await request<ExecuteExtensionCommandResponse>(
      `/v1/projects/${projectId}/extension-commands/${encodeURIComponent(commandId)}/execute`,
      {
        method: "POST",
        body: input,
      },
    );
    return response.result;
  },
});
