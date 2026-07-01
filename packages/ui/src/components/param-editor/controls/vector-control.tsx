import { Flex, Input, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { VectorValue } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorInlineGroup } from "../param-editor-inline-group";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";
import { updateVectorAxis } from "./vector-value";

interface VectorAxisInputProps {
  label: string;
  value: number;
  step?: number;
  onCommit: (raw: string) => void;
}

const VectorAxisInput = (props: VectorAxisInputProps) => {
  const { label, value, step, onCommit } = props;
  const [draft, setDraft] = useState(`${value}`);

  useEffect(() => {
    setDraft(`${value}`);
  }, [value]);

  return (
    <Flex alignItems="center" gap="1" flex="1" minW="0">
      <Text textStyle="label/XS/regular" color="fg.muted" width="1rem" flexShrink={0}>
        {label}
      </Text>
      <Input
        size="xs"
        type="number"
        step={step}
        value={draft}
        className="nodrag"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </Flex>
  );
};

interface VectorControlProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: VectorValue;
  xLabel?: string;
  yLabel?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (id: string, value: VectorValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

export const VectorControl = (props: VectorControlProps) => {
  const {
    id,
    name,
    description,
    defaultValue,
    xLabel = "X",
    yLabel = "Y",
    min,
    max,
    step = 1,
    onChange,
    readOnly,
  } = props;
  const [value, setValue] = useState<VectorValue>(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const commitAxis = (axis: "x" | "y", raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const next = updateVectorAxis(value, axis, parsed, { min, max });
    setValue(next);
    onChange(id, next);
  };

  if (readOnly) {
    return (
      <ParamEditorControlItem name={name} description={description}>
        <ParamEditorReadOnlyValue>{`${value.x}, ${value.y}`}</ParamEditorReadOnlyValue>
      </ParamEditorControlItem>
    );
  }

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked">
      <ParamEditorInlineGroup>
        <VectorAxisInput label={xLabel} value={value.x} step={step} onCommit={(raw) => commitAxis("x", raw)} />
        <VectorAxisInput label={yLabel} value={value.y} step={step} onCommit={(raw) => commitAxis("y", raw)} />
      </ParamEditorInlineGroup>
    </ParamEditorControlItem>
  );
};
