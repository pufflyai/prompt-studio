import type { CommandExecuteRequest, CommandExecuteResponse, ExtensionsCheckResponse } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";

export const checkExtensions = () => apiRequest<ExtensionsCheckResponse>("/v1/extensions/check");

export const executeExtensionCommand = (commandId: string, input: CommandExecuteRequest) =>
  apiRequest<CommandExecuteResponse>(`/v1/extensions/commands/${encodeURIComponent(commandId)}/execute`, {
    method: "POST",
    body: input,
  });
