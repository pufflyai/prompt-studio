import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { commandRefId, isLocalizedString, type ParamOptionSource } from "@pstdio/sdk/extensions";
import type { CommandParamSchema } from "@pstdio/workbench";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";

export const workspaceProviderText = (value: unknown) =>
  typeof value === "string" || isLocalizedString(value) ? resolveLocalizableString(value) : "";

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
