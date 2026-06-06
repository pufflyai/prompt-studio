import type { CommandExecuteResponse } from "@pstdio/sdk/api";

export const unwrapCommandValue = (result: unknown) => {
  const response = result as Partial<CommandExecuteResponse> | undefined;
  if (!response?.outcome) return result;
  if (response.outcome.status === "success") return response.outcome.value;
  throw new Error(response.outcome.reason ?? response.outcome.error?.message ?? "Extension command failed.");
};
