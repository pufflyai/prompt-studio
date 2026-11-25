import { Box, HStack, Input, Stack } from "@chakra-ui/react";
import { useRef } from "react";
import { ActionErrorSlot } from "@/components/primitives/action-error-slot";
import { AlertMessage } from "@/components/primitives/alert";
import { Slider } from "@/components/primitives/slider";
import { ParamEditorLabel } from "../param-editor-label";
import { useNumberEditing } from "./number-editing";
import type { NumberInputProps } from "./number-input";

export const NumberEditingInput = (props: NumberInputProps) => {
  const {
    id,
    name,
    description,
    defaultValue,
    mixed,
    min,
    max,
    step = 1,
    unit,
    onChange,
    onPreview,
    onCancel,
    readOnly,
    disabled,
    hideLabel,
    hideSlider,
    size = "sm",
  } = props;
  const input = useNumberEditing({
    value: defaultValue,
    mixed,
    min,
    max,
    step,
    onPreview: (value, interaction) => onPreview?.(value, interaction),
    onCommit: (value) => onChange(id, value),
    onCancel: () => onCancel?.(),
  });
  const cancelledSlider = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  const editable = !disabled && !readOnly;
  const label = unit ? `${name} (${unit})` : name;
  return (
    <Stack gap="xs" minW="0" w="full" position="relative">
      <HStack justify="space-between" gap="xs" minW="0">
        {!hideLabel && <ParamEditorLabel name={label} description={description} />}
        <Input
          id={id}
          aria-label={label}
          size={size}
          w={hideLabel ? "full" : "5rem"}
          flexShrink="0"
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          readOnly={readOnly}
          value={input.value}
          placeholder={mixed ? "Mixed" : undefined}
          aria-invalid={input.invalid || Boolean(input.error)}
          onFocus={input.focus}
          onChange={(event) => {
            if (editable) input.change(event.target.value);
          }}
          onBlur={(event) => {
            input.blur();
            if (editable && !feedback.current?.contains(event.relatedTarget)) void input.commit();
          }}
          onKeyDown={(event) => {
            if (!editable || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              input.cancel();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </HStack>
      {!hideSlider && min !== undefined && max !== undefined && (
        <Box px="xs">
          <Slider
            aria-label={[label]}
            min={min}
            max={max}
            step={step}
            disabled={!editable}
            value={[input.value === "" ? min : Number(input.value)]}
            onPointerDownCapture={() => {
              cancelledSlider.current = false;
            }}
            onValueChange={({ value }) => {
              if (editable && !cancelledSlider.current) input.change(String(value[0]), "slider");
            }}
            onValueChangeEnd={() => {
              if (editable && !cancelledSlider.current) void input.commit();
            }}
            onPointerCancel={() => {
              cancelledSlider.current = true;
              input.cancel();
            }}
            onKeyDownCapture={(event) => {
              if (!editable || event.nativeEvent.isComposing) return;
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelledSlider.current = true;
                input.cancel();
              } else cancelledSlider.current = false;
            }}
          />
        </Box>
      )}
      {(input.invalid || input.error) && (
        <ActionErrorSlot edge="below">
          <Box ref={feedback}>
            <AlertMessage status="error" compact>
              {input.invalid ? `Enter a valid value${unit ? ` in ${unit}` : ""}.` : input.error}
            </AlertMessage>
          </Box>
        </ActionErrorSlot>
      )}
    </Stack>
  );
};
