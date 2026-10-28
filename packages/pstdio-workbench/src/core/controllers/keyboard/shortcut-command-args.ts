import type { CommandParamSchema, WorkbenchCommandExecutionContext } from "../../registries/commands/command-registry";
import { resolveCommandResourceParams } from "../../registries/commands/command-resource-params";

export const shortcutCommandArgs = (
  params: CommandParamSchema | undefined,
  base: unknown,
  context: WorkbenchCommandExecutionContext | undefined,
) => {
  const bound = resolveCommandResourceParams(params, base, context);
  if (!Object.keys(bound).length) return base;
  return { ...(typeof base === "object" && base !== null ? base : {}), ...bound };
};
