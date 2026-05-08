import type {
  CommandExecuteRequest,
  CommandExecuteResponse,
  EnableInstalledExtensionRequest,
  EnableInstalledExtensionResponse,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type ExtensionClient = {
  enableInstalled(
    projectId: string,
    installName: string,
    request: EnableInstalledExtensionRequest,
  ): Promise<EnableInstalledExtensionResponse>;
  execute(commandId: string, request: CommandExecuteRequest): Promise<CommandExecuteResponse>;
};

export const createExtensionClient = (request: RequestFn): ExtensionClient => ({
  enableInstalled: (projectId, installName, body) =>
    request(`/v1/projects/${projectId}/extensions/installed/${encodeURIComponent(installName)}/enable`, {
      method: "POST",
      body,
    }),
  execute: (commandId, input) => {
    const { projectId, ...body } = input;
    return request(`/v1/projects/${projectId}/extensions/commands/${encodeURIComponent(commandId)}/execute`, {
      method: "POST",
      body,
    });
  },
});
