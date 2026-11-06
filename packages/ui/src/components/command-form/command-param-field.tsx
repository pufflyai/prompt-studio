import { ParamEditorRow } from "../param-editor";
import { buildCommandParam, readCommandParamValue } from "./command-param-descriptors";
import { type CommandParamEntry, type CommandParamValue, isCommandFilesParamValue } from "./command-param-values";

export interface CommandParamFieldProps {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
  /** Updates a compound field using its latest stored value. */
  onUpdateValue?: (update: (current: CommandParamValue) => CommandParamValue) => void;
  /** Reports host field validation to the containing command form. */
  onValidationChange?: (error: string | undefined) => void;
}

export const CommandParamField = (props: CommandParamFieldProps) => {
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
