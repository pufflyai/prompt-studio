import { useEffect, useState } from "react";
import { Switch } from "@/components/primitives/switch";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";

interface BooleanInputProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: boolean;
  onChange: (id: string, value: boolean) => void;
  readOnly?: boolean;
  hideLabel?: boolean;
  fullWidth?: boolean;
  size?: "xs" | "sm";
}

export const BooleanInput = (props: BooleanInputProps) => {
  const { id, name, description, defaultValue, onChange, readOnly, hideLabel, fullWidth, size = "sm" } = props;
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  if (readOnly) {
    return (
      <ParamEditorControlItem
        name={name}
        description={description}
        hideLabel={hideLabel}
        fullWidth={fullWidth}
        orientation="inline"
      >
        <ParamEditorReadOnlyValue>{String(value)}</ParamEditorReadOnlyValue>
      </ParamEditorControlItem>
    );
  }

  return (
    <ParamEditorControlItem
      name={name}
      description={description}
      hideLabel={hideLabel}
      fullWidth={fullWidth}
      orientation="inline"
    >
      <Switch
        size={size}
        checked={value}
        inputProps={{ "aria-label": name }}
        onCheckedChange={(details) => {
          setValue(details.checked);
          onChange(id, details.checked);
        }}
      />
    </ParamEditorControlItem>
  );
};
