import type { CommandExecutionResult } from "@pstdio/sdk/api";
import { getCommandValue } from "@pstdio/sdk/extensions";

export const unwrapCommandValue = (result: unknown) => {
  const response = result as Partial<CommandExecutionResult> | undefined;
  if (!response?.outcome) return result;
  return getCommandValue(response.outcome);
};
