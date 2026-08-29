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
  UpgradeProjectExtensionResponse,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type ExtensionClient = {
  enableInstalled(
    projectId: string,
    installName: string,
    request: EnableInstalledExtensionRequest,
  ): Promise<EnableInstalledExtensionResponse>;
  listAppearance(projectId: string): Promise<ListExtensionAppearanceResponse>;
  listCommands(projectId: string): Promise<ListExtensionCommandsResponse>;
  listProject(projectId: string): Promise<ListProjectExtensionsResponse>;
  upgradeProject(projectId: string, instanceId: string): Promise<UpgradeProjectExtensionResponse>;
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
  listAppearance: (projectId) => request(`/v1/projects/${projectId}/extensions/appearance`),
  listCommands: (projectId) => request(`/v1/projects/${projectId}/extensions/commands`),
  listProject: (projectId) => request(`/v1/projects/${projectId}/extensions`),
  upgradeProject: (projectId, instanceId) =>
    request(`/v1/projects/${projectId}/extensions/${encodeURIComponent(instanceId)}/upgrade`, { method: "POST" }),
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
