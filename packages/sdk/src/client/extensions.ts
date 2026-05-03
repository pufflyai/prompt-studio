import type {
  CommandExecuteRequest,
  CommandExecuteResponse,
  ExtensionsCheckResponse,
  SetupProjectExtensionResponse,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type ExtensionClient = {
  check(): Promise<ExtensionsCheckResponse>;
  setupProjectExtension(projectId: string, installName: string): Promise<SetupProjectExtensionResponse>;
  execute(commandId: string, input: CommandExecuteRequest): Promise<CommandExecuteResponse>;
};

export const createExtensionClient = (request: RequestFn): ExtensionClient => ({
  check: () => request("/v1/extensions/check"),
  setupProjectExtension: (projectId, installName) =>
    request(`/v1/projects/${projectId}/extensions/${encodeURIComponent(installName)}/setup`, { method: "POST" }),
  execute: (commandId, input) =>
    request(`/v1/extensions/commands/${encodeURIComponent(commandId)}/execute`, {
      method: "POST",
      body: input,
    }),
});
