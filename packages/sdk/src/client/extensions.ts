import type {
  CommandExecuteBody,
  CommandExecuteRequest,
  CommandExecuteResponse,
  CommandExecutionResult,
  ConfigureExtensionConnectionInput,
  DeleteExtensionConnectionInput,
  DispatchExtensionEventInput,
  EnableInstalledExtensionRequest,
  EnableInstalledExtensionResponse,
  ExtensionConnectionRecord,
  ExtensionDiagnosticsResponse,
  InstallExtensionRequest,
  InstallExtensionResponse,
  JsonValue,
  ListExtensionAppearanceResponse,
  ListExtensionCommandsResponse,
  ListExtensionConnectionsResponse,
  ListProjectExtensionsResponse,
  StartExtensionOAuthResponse,
  UpgradeProjectExtensionResponse,
} from "pstdio-api-contracts";
import type { ExtensionOAuthStatus } from "pstdio-api-contracts/extension-kernel";
import type { CommandStream } from "../extensions/command-stream";
import { type AccountReadIdentity, expectedIdentityQuery } from "./account";
import { createExtensionControlsClient } from "./extension-controls";
import { createExtensionManagementClient } from "./extension-management";
import { type CommandStreamClientEvent, openExtensionCommandStream, streamExtensionCommand } from "./extension-stream";
import type { RequestFn } from "./request";
import type { createSessionStreamTransport } from "./session-stream";

const oauthPath = (projectId: string, extensionId: string, connectionId: string) =>
  `/v1/projects/${encodeURIComponent(projectId)}/extension-connections/${encodeURIComponent(extensionId)}/${encodeURIComponent(connectionId)}/oauth`;

export type ExtensionClient = ReturnType<typeof createExtensionControlsClient> &
  ReturnType<typeof createExtensionManagementClient> & {
    install(
      projectId: string,
      input: InstallExtensionRequest | { upload: FormData },
      options?: { signal?: AbortSignal },
    ): Promise<InstallExtensionResponse>;
    diagnostics(projectId: string, options?: { scope?: "user" | "repo" }): Promise<ExtensionDiagnosticsResponse>;
    streamCommand(
      projectId: string,
      commandId: string,
      input?: CommandExecuteBody,
      options?: { signal?: AbortSignal },
    ): CommandStream<JsonValue>;
    /** @deprecated Use streamCommand for chunks and a complete final outcome. */
    stream(
      commandId: string,
      input: CommandExecuteRequest,
      options?: { signal?: AbortSignal },
    ): AsyncIterable<CommandStreamClientEvent>;
    enableInstalled(
      projectId: string,
      installName: string,
      request: EnableInstalledExtensionRequest,
    ): Promise<EnableInstalledExtensionResponse>;
    listAppearance(projectId: string, options?: { signal?: AbortSignal }): Promise<ListExtensionAppearanceResponse>;
    listCommands(projectId: string): Promise<ListExtensionCommandsResponse>;
    listProject(projectId: string, options?: { signal?: AbortSignal }): Promise<ListProjectExtensionsResponse>;
    upgradeProject(projectId: string, instanceId: string): Promise<UpgradeProjectExtensionResponse>;
    listConnections(projectId: string): Promise<ListExtensionConnectionsResponse>;
    configureConnection(
      projectId: string,
      extensionId: string,
      connectionId: string,
      input: ConfigureExtensionConnectionInput,
    ): Promise<ExtensionConnectionRecord>;
    startConnectionOAuth(
      projectId: string,
      extensionId: string,
      connectionId: string,
      expected?: AccountReadIdentity | null,
    ): Promise<StartExtensionOAuthResponse>;
    connectionOAuthStatus(projectId: string, extensionId: string, connectionId: string): Promise<ExtensionOAuthStatus>;
    disconnectConnectionOAuth(
      projectId: string,
      extensionId: string,
      connectionId: string,
      expected?: AccountReadIdentity | null,
    ): Promise<void>;
    checkConnection(projectId: string, extensionId: string, connectionId: string): Promise<ExtensionConnectionRecord>;
    deleteConnection(
      projectId: string,
      extensionId: string,
      connectionId: string,
      input?: DeleteExtensionConnectionInput,
    ): Promise<void>;
    execute(
      commandId: string,
      request: CommandExecuteRequest,
      options?: { signal?: AbortSignal },
    ): Promise<CommandExecutionResult & CommandExecuteResponse>;
    dispatchEvent(projectId: string, input: DispatchExtensionEventInput): Promise<void>;
  };

export const createExtensionClient = (
  request: RequestFn,
  streams: ReturnType<typeof createSessionStreamTransport>,
): ExtensionClient => ({
  ...createExtensionControlsClient(request),
  ...createExtensionManagementClient(request),
  install: (projectId, input, options) =>
    request(`/v1/projects/${projectId}/extensions/install`, {
      method: "POST",
      body: "upload" in input ? input.upload : input,
      signal: options?.signal,
    }),
  diagnostics: (projectId, options) =>
    request(`/v1/projects/${projectId}/extensions/diagnostics${options?.scope ? `?scope=${options.scope}` : ""}`),
  stream: (commandId, input, options) => streamExtensionCommand(streams, commandId, input, options),
  streamCommand: (projectId, commandId, input, options) =>
    openExtensionCommandStream(streams, projectId, commandId, input, options),
  enableInstalled: (projectId, installName, body) =>
    request(`/v1/projects/${projectId}/extensions/installed/${encodeURIComponent(installName)}/enable`, {
      method: "POST",
      body,
    }),
  listAppearance: (projectId, options) => request(`/v1/projects/${projectId}/extensions/appearance`, options),
  listCommands: (projectId) => request(`/v1/projects/${projectId}/extensions/commands`),
  listProject: (projectId, options) => request(`/v1/projects/${projectId}/extensions`, options),
  upgradeProject: (projectId, instanceId) =>
    request(`/v1/projects/${projectId}/extensions/${encodeURIComponent(instanceId)}/upgrade`, { method: "POST" }),
  listConnections: (projectId) => request(`/v1/projects/${projectId}/extension-connections`),
  configureConnection: (projectId, extensionId, connectionId, body) =>
    request(
      `/v1/projects/${projectId}/extension-connections/${encodeURIComponent(extensionId)}/${encodeURIComponent(connectionId)}`,
      { method: "PUT", body },
    ),
  startConnectionOAuth: (projectId, extensionId, connectionId, expected) =>
    request(oauthPath(projectId, extensionId, connectionId) + expectedIdentityQuery(expected), { method: "POST" }),
  connectionOAuthStatus: (projectId, extensionId, connectionId) =>
    request(oauthPath(projectId, extensionId, connectionId)),
  disconnectConnectionOAuth: (projectId, extensionId, connectionId, expected) =>
    request(oauthPath(projectId, extensionId, connectionId) + expectedIdentityQuery(expected), { method: "DELETE" }),
  checkConnection: (projectId, extensionId, connectionId) =>
    request(
      `/v1/projects/${projectId}/extension-connections/${encodeURIComponent(extensionId)}/${encodeURIComponent(connectionId)}/check`,
      { method: "POST" },
    ),
  deleteConnection: (projectId, extensionId, connectionId, input) => {
    const query = new URLSearchParams();
    if (input?.credentialScope !== undefined) query.set("credentialScope", input.credentialScope);
    if (input?.origin !== undefined) query.set("origin", input.origin);
    if (input?.signInScope !== undefined) query.set("signInScope", input.signInScope);
    const path = `/v1/projects/${projectId}/extension-connections/${encodeURIComponent(extensionId)}/${encodeURIComponent(connectionId)}`;
    return request(query.size ? `${path}?${query}` : path, { method: "DELETE" });
  },
  execute: (commandId, input, options) => {
    const { projectId, ...body } = input;
    return request(`/v1/projects/${projectId}/extensions/commands/${encodeURIComponent(commandId)}/execute`, {
      method: "POST",
      body,
      signal: options?.signal,
    });
  },
  dispatchEvent: (projectId, body) =>
    request(`/v1/projects/${projectId}/extensions/events/dispatch`, {
      method: "POST",
      body,
    }),
});
