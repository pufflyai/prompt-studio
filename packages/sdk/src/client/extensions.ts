import type {
  CommandExecuteRequest,
  CommandExecuteResponse,
  EnableInstalledExtensionRequest,
  EnableInstalledExtensionResponse,
  ListExtensionAppearanceResponse,
  ListExtensionCommandsResponse,
  UpdateInstalledExtensionTemplateInput,
  UpdateInstalledExtensionTemplateResponse,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type ExtensionClient = {
  enableInstalled(
    projectId: string,
    installName: string,
    request: EnableInstalledExtensionRequest,
  ): Promise<EnableInstalledExtensionResponse>;
  updateInstalledTemplate(
    installName: string,
    templateKey: string,
    input: UpdateInstalledExtensionTemplateInput,
  ): Promise<UpdateInstalledExtensionTemplateResponse>;
  listAppearance(projectId: string): Promise<ListExtensionAppearanceResponse>;
  listCommands(projectId: string): Promise<ListExtensionCommandsResponse>;
  execute(commandId: string, request: CommandExecuteRequest): Promise<CommandExecuteResponse>;
};

export const createExtensionClient = (request: RequestFn): ExtensionClient => ({
  enableInstalled: (projectId, installName, body) =>
    request(`/v1/projects/${projectId}/extensions/installed/${encodeURIComponent(installName)}/enable`, {
      method: "POST",
      body,
    }),
  updateInstalledTemplate: (installName, templateKey, body) =>
    request(
      `/v1/extensions/installed/${encodeURIComponent(installName)}/templates/${encodeURIComponent(templateKey)}`,
      {
        method: "PUT",
        body,
      },
    ),
  listAppearance: (projectId) => request(`/v1/projects/${projectId}/extensions/appearance`),
  listCommands: (projectId) => request(`/v1/projects/${projectId}/extensions/commands`),
  execute: (commandId, input) => {
    const { projectId, ...body } = input;
    return request(`/v1/projects/${projectId}/extensions/commands/${encodeURIComponent(commandId)}/execute`, {
      method: "POST",
      body,
    });
  },
});
