import { Box, type SliderValueChangeDetails, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Slider } from "@/components/primitives/slider";
import type { RangeValue } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";
import { formatUnitValue } from "./numeric-value";
import { normalizeRange } from "./range-value";
import { SliderMarks } from "./slider-marks";

interface RangeInputProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: RangeValue;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  markerCount?: number;
  onChange: (id: string, value: RangeValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

export const RangeInput = (props: RangeInputProps) => {
  const {
    id,
    name,
    description,
    defaultValue,
    min,
    max,
    step = 1,
    unit,
    markerCount,
    onChange,
    readOnly,
    fullWidth,
  } = props;

  const [value, setValue] = useState<RangeValue>(() => normalizeRange(defaultValue, min, max, step));

  useEffect(() => {
    setValue(normalizeRange(defaultValue, min, max, step));
  }, [defaultValue, min, max, step]);

  const label = `${formatUnitValue(value[0], unit)} – ${formatUnitValue(value[1], unit)}`;

  if (readOnly) {
    return (
      <ParamEditorControlItem name={name} description={description} fullWidth={fullWidth}>
        <ParamEditorReadOnlyValue>{label}</ParamEditorReadOnlyValue>
      </ParamEditorControlItem>
    );
  }

  const trailing = (
    <Text textStyle="label/S/regular" color="fg.muted" whiteSpace="nowrap">
      {label}
    </Text>
  );

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked" labelTrailing={trailing}>
      <Box>
        <Slider
          size="sm"
          value={value}
          min={min}
          max={max}
          step={step}
          onValueChange={(details: SliderValueChangeDetails) =>
            setValue(normalizeRange(details.value as RangeValue, min, max, step))
          }
          onValueChangeEnd={(details: SliderValueChangeDetails) => {
            const next = normalizeRange(details.value as RangeValue, min, max, step);
            setValue(next);
            onChange(id, next);
          }}
        />
        <SliderMarks count={markerCount} />
      </Box>
    </ParamEditorControlItem>
  );
};
