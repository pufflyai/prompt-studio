import { ParamEditorRow } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchCommandExecutionContext } from "../../core";
import { type CommandParamEntry, type CommandParamValue, isCommandFilesParamValue } from "./command-palette-params";
import { buildCommandParam, readCommandParamValue } from "./command-param-descriptors";

export interface CommandParamFieldProps {
  entry: CommandParamEntry;
  value: CommandParamValue;
  context?: WorkbenchCommandExecutionContext;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}

// Lets the host supply field UI for param types the workbench cannot render on its
// own (e.g. harness/repo selectors backed by host data). Returning a falsy value
// defers to the built-in field for that entry.
export type CommandParamFieldRenderer = (props: CommandParamFieldProps) => ReactNode;

export const CommandParamField = (props: Omit<CommandParamFieldProps, "context">) => {
  const { entry, value, disabled, onChange } = props;

  const change = (next: Parameters<typeof readCommandParamValue>[0]) => {
    const nextValue = readCommandParamValue(next, entry);
    if (entry.type !== "files" || !isCommandFilesParamValue(value) || !isCommandFilesParamValue(nextValue)) {
      onChange(nextValue);
      return;
    }

    const refs = entry.multiple === false && nextValue.uploads.length > 0 ? [] : value.refs;
    onChange({ ...nextValue, refs });
  };

  return (
    <ParamEditorRow
      param={buildCommandParam(entry, value)}
      readOnly={disabled}
      onChange={(_id, next) => change(next)}
    />
  );
};
