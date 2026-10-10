import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import {
  type CommandOptionState,
  CommandOptionStatus,
  CommandParamField,
  type CommandParamValue,
  listCommandParamEntries,
} from "@pstdio/workbench/react";
import { Fragment } from "react";
import { workspaceProviderParamSchema, workspaceProviderText } from "./workspace-provider-param-schema";

interface WorkspaceProviderFieldsProps {
  typeLabel: string;
  providers: WorkspaceProviderDescriptor[];
  provider: WorkspaceProviderDescriptor;
  values: Record<string, CommandParamValue>;
  disabled: boolean;
  optionStates: Record<string, CommandOptionState>;
  onRetryOptions: (key: string) => void;
  onProviderChange: (providerId: string) => void;
  onValueChange: (key: string, value: CommandParamValue) => void;
}

// The workspace type select followed by the selected provider's own params.
// Shared by the "Create workspace" dialog and `workspace` command params.
export const WorkspaceProviderFields = (props: WorkspaceProviderFieldsProps) => {
  const {
    typeLabel,
    providers,
    provider,
    values,
    disabled,
    optionStates,
    onRetryOptions,
    onProviderChange,
    onValueChange,
  } = props;
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
      {listCommandParamEntries(workspaceProviderParamSchema(provider)).map((entry) => {
        const dynamic = entry.options && !Array.isArray(entry.options);
        const state = optionStates[entry.key];
        return (
          <Fragment key={entry.key}>
            <CommandParamField
              entry={dynamic ? { ...entry, options: state?.options ?? [] } : entry}
              value={values[entry.key]}
              disabled={disabled || Boolean(dynamic && state?.status !== "ready")}
              onChange={(value) => onValueChange(entry.key, value)}
            />
            {dynamic ? <CommandOptionStatus state={state} onRetry={() => onRetryOptions(entry.key)} /> : null}
          </Fragment>
        );
      })}
    </>
  );
};
