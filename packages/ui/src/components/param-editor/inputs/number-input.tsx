import { Box, Flex, type NumberInputValueChangeDetails, type SliderValueChangeDetails } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { NumberInputField, NumberInputRoot } from "@/components/primitives/number-input";
import { Slider } from "@/components/primitives/slider";
import { ParamEditorLabel } from "../param-editor-label";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";

interface NumberInputProps {
  id: string;
  defaultValue: number;
  name: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (id: string, value: number) => void;
  description: string;
  readOnly?: boolean;
  hideLabel?: boolean;
  hideSlider?: boolean;
  tooltipPlacement?: "top" | "right" | "bottom" | "left";
  fullWidth?: boolean;
}

export const NumberInput = (props: NumberInputProps) => {
  const {
    id,
    defaultValue,
    name,
    step = 1,
    min,
    max,
    onChange,
    description,
    readOnly,
    hideLabel = false,
    hideSlider = false,
    fullWidth = false,
  } = props;
  const [value, setValue] = useState(defaultValue);
  const isRange = min !== undefined && max !== undefined;
  const showSlider = isRange && !hideSlider;
  const useFullWidthLayout = fullWidth && !showSlider;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleChange = (nextValue: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(id, nextValue), 540);
  };

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  if (readOnly) {
    const valueElement = <ParamEditorReadOnlyValue>{value}</ParamEditorReadOnlyValue>;

    if (fullWidth) {
      return (
        <Box>
          {!hideLabel && (
            <Box mb="xs">
              <ParamEditorLabel name={name} description={description} />
            </Box>
          )}
          {valueElement}
        </Box>
      );
    }

    return (
      <Box>
        <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
          {!hideLabel && <ParamEditorLabel name={name} description={description} />}
          {valueElement}
        </Flex>
      </Box>
    );
  }

  return (
    <Box>
      {useFullWidthLayout ? (
        <Box>
          {!hideLabel && (
            <Box mb="xs">
              <ParamEditorLabel name={name} description={description} />
            </Box>
          )}
          <NumberInputRoot
            disabled={readOnly}
            width="100%"
            size="sm"
            value={`${value}`}
            step={step}
            min={min}
            max={max}
            onValueChange={(details: NumberInputValueChangeDetails) => {
              const next = Number.isNaN(details.valueAsNumber) ? (min ?? 0) : details.valueAsNumber;
              setValue(next);
              scheduleChange(next);
            }}
          >
            <NumberInputField
              className="nodrag"
              h="2rem"
              readOnly={readOnly}
              placeholder={hideLabel ? name : undefined}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
          </NumberInputRoot>
        </Box>
      ) : (
        <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
          {!hideLabel && <ParamEditorLabel name={name} description={description} />}
          <NumberInputRoot
            disabled={readOnly}
            width="5rem"
            size="sm"
            value={`${value}`}
            step={step}
            min={min}
            max={max}
            onValueChange={(details: NumberInputValueChangeDetails) => {
              const next = Number.isNaN(details.valueAsNumber) ? (min ?? 0) : details.valueAsNumber;
              setValue(next);
              scheduleChange(next);
            }}
          >
            <NumberInputField
              className="nodrag"
              h="2rem"
              readOnly={readOnly}
              placeholder={hideLabel ? name : undefined}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
          </NumberInputRoot>
        </Flex>
      )}
      {showSlider && (
        <Slider
          size="sm"
          disabled={readOnly}
          value={[value]}
          step={step}
          min={min}
          max={max}
          onValueChange={(details: SliderValueChangeDetails) => {
            setValue(details.value[0]);
          }}
          onValueChangeEnd={(details: SliderValueChangeDetails) => {
            onChange(id, details.value[0]);
          }}
        />
      )}
    </Box>
  );
};
