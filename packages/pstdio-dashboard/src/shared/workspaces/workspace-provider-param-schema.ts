import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { commandRefId, isLocalizedString, type ParamOptionSource } from "@pstdio/sdk/extensions";
import type { CommandParamSchema } from "@pstdio/workbench";

// Provider descriptors have no translation namespace here. Reading their fallback labels is pure;
// it must not initialize a runtime/API owner (including in sandboxed Canvas frames).
export const workspaceProviderText = (value: unknown) => {
  if (typeof value === "string") return value;
  return isLocalizedString(value) ? (value.default ?? value.$l10n) : "";
};

const workspaceProviderOptions = (value: unknown) => {
  if (Array.isArray(value)) return value.map((option) => ({ ...option, label: workspaceProviderText(option.label) }));
  const source = value as ParamOptionSource;
  return {
    commandId: commandRefId(source.command),
    valueField: source.valueField,
    labelField: source.labelField,
    params: source.params,
  };
};

export const workspaceProviderParamSchema = (provider: WorkspaceProviderDescriptor) =>
  Object.fromEntries(
    Object.entries(provider.params).map(([key, param]) => [
      key,
      {
        ...param,
        label: workspaceProviderText(param.label) || key,
        description: workspaceProviderText(param.description),
        ...(param.type === "select" || param.type === "multi-select"
          ? {
              options: workspaceProviderOptions(param.options),
            }
          : {}),
      },
    ]),
  ) as CommandParamSchema;
