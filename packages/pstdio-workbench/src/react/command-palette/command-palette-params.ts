import { buildCommandParamInitialValues as buildFormValues } from "@pstdio/ui/command-form";
import type { Command, CommandParamSchema, WorkbenchCommandExecutionContext } from "../../core";
import { resourceContextValue } from "../../core/registries/commands/command-resource-params";

export {
  type CommandFilesParamValue,
  type CommandParamEntry,
  type CommandParamValue,
  createCommandFilesParamValue,
  hasCommandParameters,
  isCommandFilesParamValue,
  isFileUploadValue,
  listCommandParamEntries,
  mergeCommandParamArgs,
  normalizeCommandParamValues,
} from "@pstdio/ui/command-form";
export { resolveCommandResourceParams } from "../../core/registries/commands/command-resource-params";

const renameLabelDefault = (
  key: string,
  base: Record<string, unknown>,
  context: WorkbenchCommandExecutionContext | undefined,
  mutation: Command["resourceMutation"],
) => {
  const resource = context?.resource;
  if (mutation?.kind !== "rename" || key !== mutation.labelParam || resource?.type !== mutation.resourceType)
    return undefined;
  const id = base[mutation.idParam];
  return id === undefined || id === resource.id ? resource.label : undefined;
};
export const buildCommandParamInitialValues = (
  params: CommandParamSchema | undefined,
  baseArgs?: unknown,
  context?: WorkbenchCommandExecutionContext,
  mutation?: Command["resourceMutation"],
) => {
  const base =
    typeof baseArgs === "object" && baseArgs !== null && !Array.isArray(baseArgs)
      ? (baseArgs as Record<string, unknown>)
      : {};
  const defaults = Object.fromEntries(
    Object.entries(params ?? {}).map(([key, entry]) => [
      key,
      Object.hasOwn(base, key)
        ? base[key]
        : (renameLabelDefault(key, base, context, mutation) ??
          resourceContextValue({ ...entry, key }, context) ??
          entry.defaultValue),
    ]),
  );
  return buildFormValues(params, defaults);
};
