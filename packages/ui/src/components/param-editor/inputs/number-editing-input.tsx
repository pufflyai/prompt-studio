import { Box, Input, Stack, Text } from "@chakra-ui/react";
import { useRef } from "react";
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
  const editable = !disabled && !readOnly;
  const label = unit ? `${name} (${unit})` : name;
  return (
    <Stack gap="xs" minW="0" w="full">
      {!hideLabel && <ParamEditorLabel name={label} description={description} />}
      <Input
        id={id}
        aria-label={label}
        size={size}
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
        onBlur={() => {
          input.blur();
          if (editable) void input.commit();
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
      {input.invalid && (
        <Text role="alert" color="fg.error" textStyle="label/XS">
          Enter a valid value{unit ? ` in ${unit}` : ""}.
        </Text>
      )}
      {input.error && (
        <Text role="alert" color="fg.error" textStyle="label/XS">
          {input.error}
        </Text>
      )}
    </Stack>
  );
};
