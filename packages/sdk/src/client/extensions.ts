import type {
  CommandExecuteRequest,
  CommandExecuteResponse,
  ConfigureExtensionConnectionInput,
  DispatchExtensionEventInput,
  EnableInstalledExtensionRequest,
  EnableInstalledExtensionResponse,
  ExtensionConnectionRecord,
  ListExtensionAppearanceResponse,
  ListExtensionCommandsResponse,
  ListExtensionConnectionsResponse,
  ListProjectExtensionsResponse,
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
  listProject(projectId: string): Promise<ListProjectExtensionsResponse>;
  listConnections(projectId: string): Promise<ListExtensionConnectionsResponse>;
  configureConnection(
    projectId: string,
    extensionId: string,
    connectionId: string,
    input: ConfigureExtensionConnectionInput,
  ): Promise<ExtensionConnectionRecord>;
  checkConnection(projectId: string, extensionId: string, connectionId: string): Promise<ExtensionConnectionRecord>;
  deleteConnection(projectId: string, extensionId: string, connectionId: string): Promise<void>;
  execute(commandId: string, request: CommandExecuteRequest): Promise<CommandExecuteResponse>;
  dispatchEvent(projectId: string, input: DispatchExtensionEventInput): Promise<void>;
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
  listProject: (projectId) => request(`/v1/projects/${projectId}/extensions`),
  listConnections: (projectId) => request(`/v1/projects/${projectId}/extension-connections`),
  configureConnection: (projectId, extensionId, connectionId, body) =>
    request(
      `/v1/projects/${projectId}/extension-connections/${encodeURIComponent(extensionId)}/${encodeURIComponent(connectionId)}`,
      { method: "PUT", body },
    ),
  checkConnection: (projectId, extensionId, connectionId) =>
    request(
      `/v1/projects/${projectId}/extension-connections/${encodeURIComponent(extensionId)}/${encodeURIComponent(connectionId)}/check`,
      { method: "POST" },
    ),
  deleteConnection: (projectId, extensionId, connectionId) =>
    request(
      `/v1/projects/${projectId}/extension-connections/${encodeURIComponent(extensionId)}/${encodeURIComponent(connectionId)}`,
      { method: "DELETE" },
    ),
  execute: (commandId, input) => {
    const { projectId, ...body } = input;
    return request(`/v1/projects/${projectId}/extensions/commands/${encodeURIComponent(commandId)}/execute`, {
      method: "POST",
      body,
    });
  },
  dispatchEvent: (projectId, body) =>
    request(`/v1/projects/${projectId}/extensions/events/dispatch`, {
      method: "POST",
      body,
    }),
});
