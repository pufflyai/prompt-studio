import { Box, IconButton, Input, type SliderValueChangeDetails } from "@chakra-ui/react";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Slider } from "@/components/primitives/slider";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";
import { formatUnitValue, parseUnitValue, resolveNumericValue } from "./numeric-value";
import { SliderMarks } from "./slider-marks";

interface SliderControlProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  markerCount?: number;
  baseValue?: number;
  variant?: "continuous" | "discrete";
  onChange: (id: string, value: number) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

export const SliderControl = (props: SliderControlProps) => {
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
    baseValue,
    variant = "continuous",
    onChange,
    readOnly,
    fullWidth,
  } = props;

  const discrete = variant === "discrete";
  const resolve = (input: number) => resolveNumericValue({ value: input, min, max, step, discrete });
  const [value, setValue] = useState(() => resolve(defaultValue));
  const [draftLabel, setDraftLabel] = useState<string | null>(null);

  useEffect(() => {
    setValue(resolveNumericValue({ value: defaultValue, min, max, step, discrete }));
  }, [defaultValue, min, max, step, discrete]);

  const commit = (next: number) => {
    const resolved = resolve(next);
    setValue(resolved);
    onChange(id, resolved);
  };

  if (readOnly) {
    return (
      <ParamEditorControlItem name={name} description={description} fullWidth={fullWidth}>
        <ParamEditorReadOnlyValue>{formatUnitValue(value, unit)}</ParamEditorReadOnlyValue>
      </ParamEditorControlItem>
    );
  }

  const canReset = baseValue !== undefined && value !== baseValue;

  const trailing = (
    <>
      {canReset ? (
        <IconButton aria-label="Reset" size="2xs" variant="ghost" onClick={() => commit(baseValue as number)}>
          <RotateCcw />
        </IconButton>
      ) : null}
      <Input
        size="xs"
        width="4rem"
        textAlign="right"
        className="nodrag"
        value={draftLabel ?? formatUnitValue(value, unit)}
        onChange={(event) => setDraftLabel(event.target.value)}
        onFocus={() => setDraftLabel(formatUnitValue(value, unit))}
        onBlur={() => {
          if (draftLabel !== null) {
            const parsed = parseUnitValue(draftLabel, unit);
            if (parsed !== null) commit(parsed);
            setDraftLabel(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </>
  );

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked" labelTrailing={trailing}>
      <Box>
        <Slider
          size="sm"
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(details: SliderValueChangeDetails) => setValue(resolve(details.value[0]))}
          onValueChangeEnd={(details: SliderValueChangeDetails) => commit(details.value[0])}
        />
        <SliderMarks count={markerCount} />
      </Box>
    </ParamEditorControlItem>
  );
};
