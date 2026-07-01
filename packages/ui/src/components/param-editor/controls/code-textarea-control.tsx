import { Textarea } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";

interface CodeTextareaControlProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: string;
  language?: string;
  minRows?: number;
  onChange: (id: string, value: string) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

export const CodeTextareaControl = (props: CodeTextareaControlProps) => {
  const { id, name, description, defaultValue, minRows = 4, onChange, readOnly } = props;
  const [value, setValue] = useState(defaultValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const scheduleChange = (next: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(id, next), 540);
  };

  if (readOnly) {
    return (
      <ParamEditorControlItem name={name} description={description} orientation="stacked">
        <ParamEditorReadOnlyValue preserveWhitespace fontFamily="mono" fontSize="xs">
          {value}
        </ParamEditorReadOnlyValue>
      </ParamEditorControlItem>
    );
  }

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked">
      <Textarea
        className="nodrag"
        value={value}
        rows={minRows}
        fontFamily="mono"
        fontSize="xs"
        spellCheck={false}
        resize="vertical"
        onChange={(event) => {
          setValue(event.target.value);
          scheduleChange(event.target.value);
        }}
      />
    </ParamEditorControlItem>
  );
};
