import type { CommandExecuteRequest, CommandExecuteResponse, ExtensionsCheckResponse } from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type ExtensionClient = {
  check(): Promise<ExtensionsCheckResponse>;
  execute(commandId: string, input: CommandExecuteRequest): Promise<CommandExecuteResponse>;
};

export const createExtensionClient = (request: RequestFn): ExtensionClient => ({
  check: () => request("/v1/extensions/check"),
  execute: (commandId, input) =>
    request(`/v1/extensions/commands/${encodeURIComponent(commandId)}/execute`, {
      method: "POST",
      body: input,
    }),
});
