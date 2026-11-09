import { ParamEditorRow } from "../param-editor";
import { buildCommandParam, readCommandParamValue } from "./command-param-descriptors";
import { type CommandParamEntry, type CommandParamValue, isCommandFilesParamValue } from "./command-param-values";

export interface CommandParamFieldProps {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  fullWidth?: boolean;
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

  const param = buildCommandParam(entry, value);
  // Pending options must make the existing picker inert, rather than replace
  // its component tree and dismiss an open menu on a search-field blur.
  const selection = param.type === "selection";
  return (
    <ParamEditorRow
      fullWidth={props.fullWidth}
      changeDelay={0}
      param={
        selection
          ? {
              ...param,
              disabled: disabled || param.disabled,
              options: param.options.map((option) => ({
                ...option,
                disabled: disabled || param.disabled || option.disabled,
              })),
            }
          : param
      }
      readOnly={!selection && disabled}
      onChange={(_id, next) => change(next)}
    />
  );
};
