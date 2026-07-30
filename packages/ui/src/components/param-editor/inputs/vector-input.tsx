import { Flex, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { VectorValue } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorInlineGroup } from "../param-editor-inline-group";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";
import { NumberInput } from "./number-input";
import { updateVectorAxis } from "./vector-value";

interface VectorInputProps {
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

interface VectorAxisFieldProps {
  label: string;
  fieldId: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void;
}

// A single axis: the shared NumberInput (label/slider hidden) prefixed with its axis letter.
const VectorAxisField = (props: VectorAxisFieldProps) => {
  const { label, fieldId, value, min, max, step, onCommit } = props;

  return (
    <Flex alignItems="center" gap="1" flexShrink={0}>
      <Text textStyle="label/XS/regular" color="fg.muted" width="1rem" flexShrink={0}>
        {label}
      </Text>
      <NumberInput
        id={fieldId}
        name={label}
        description=""
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        hideLabel
        hideSlider
        onChange={(_, next) => onCommit(next)}
      />
    </Flex>
  );
};

export const VectorInput = (props: VectorInputProps) => {
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

  const commitAxis = (axis: "x" | "y", next: number) => {
    const updated = updateVectorAxis(value, axis, next, { min, max });
    setValue(updated);
    onChange(id, updated);
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
        <VectorAxisField
          label={xLabel}
          fieldId={`${id}.x`}
          value={value.x}
          min={min}
          max={max}
          step={step}
          onCommit={(next) => commitAxis("x", next)}
        />
        <VectorAxisField
          label={yLabel}
          fieldId={`${id}.y`}
          value={value.y}
          min={min}
          max={max}
          step={step}
          onCommit={(next) => commitAxis("y", next)}
        />
      </ParamEditorInlineGroup>
    </ParamEditorControlItem>
  );
};
