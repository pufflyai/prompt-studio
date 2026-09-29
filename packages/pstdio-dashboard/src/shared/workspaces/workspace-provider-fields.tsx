import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { isLocalizedString } from "@pstdio/sdk/extensions";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import type { CommandParamSchema } from "@pstdio/workbench";
import { CommandParamField, type CommandParamValue, listCommandParamEntries } from "@pstdio/workbench/react";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";

const workspaceProviderText = (value: unknown) =>
  typeof value === "string" || isLocalizedString(value) ? resolveLocalizableString(value) : "";

export const workspaceProviderParamSchema = (provider: WorkspaceProviderDescriptor): CommandParamSchema =>
  Object.fromEntries(
    Object.entries(provider.params).map(([key, param]) => [
      key,
      {
        ...param,
        label: workspaceProviderText(param.label) || key,
        description: workspaceProviderText(param.description),
        ...(Array.isArray(param.options)
          ? { options: param.options.map((option) => ({ ...option, label: workspaceProviderText(option.label) })) }
          : {}),
      },
    ]),
  ) as CommandParamSchema;

interface WorkspaceProviderFieldsProps {
  typeLabel: string;
  providers: WorkspaceProviderDescriptor[];
  provider: WorkspaceProviderDescriptor;
  values: Record<string, CommandParamValue>;
  disabled: boolean;
  onProviderChange: (providerId: string) => void;
  onValueChange: (key: string, value: CommandParamValue) => void;
}

// The workspace type select followed by the selected provider's own params.
// Shared by the "Create workspace" dialog and `workspace` command params.
export const WorkspaceProviderFields = (props: WorkspaceProviderFieldsProps) => {
  const { typeLabel, providers, provider, values, disabled, onProviderChange, onValueChange } = props;
  return (
    <>
      <ParamEditorRow
        param={{
          id: "workspace-type",
          type: "selection",
          name: typeLabel,
          description: workspaceProviderText(provider.description),
          options: providers.map((option) => ({
            id: option.id,
            name: workspaceProviderText(option.label),
            icon: option.icon,
          })),
          defaultValue: provider.id,
          clearable: false,
        }}
        readOnly={disabled}
        onChange={(_id, value) => {
          if (typeof value === "string") onProviderChange(value);
        }}
      />
      {listCommandParamEntries(workspaceProviderParamSchema(provider)).map((entry) => (
        <CommandParamField
          key={entry.key}
          entry={entry}
          value={values[entry.key]}
          disabled={disabled}
          onChange={(value) => onValueChange(entry.key, value)}
        />
      ))}
    </>
  );
};
