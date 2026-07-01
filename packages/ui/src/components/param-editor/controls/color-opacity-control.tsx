import {
  Box,
  ColorPicker,
  type ColorPickerValueChangeDetails,
  Flex,
  parseColor,
  type SliderValueChangeDetails,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Slider } from "@/components/primitives/slider";
import type { ColorOpacityValue } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";
import { clampToRange } from "./numeric-value";

interface ColorOpacityControlProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: ColorOpacityValue;
  onChange: (id: string, value: ColorOpacityValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

export const ColorOpacityControl = (props: ColorOpacityControlProps) => {
  const { id, name, description, defaultValue, onChange, readOnly, fullWidth } = props;
  const [value, setValue] = useState<ColorOpacityValue>(defaultValue);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const commit = (next: ColorOpacityValue) => {
    setValue(next);
    onChange(id, next);
  };

  if (readOnly) {
    return (
      <ParamEditorControlItem name={name} description={description} fullWidth={fullWidth}>
        <ParamEditorReadOnlyValue>
          <Flex alignItems="center" gap="xs">
            <Box boxSize="0.75rem" borderRadius="xs" bg={value.hex} opacity={value.opacity / 100} />
            <Box as="span">{`${value.hex} · ${value.opacity}%`}</Box>
          </Flex>
        </ParamEditorReadOnlyValue>
      </ParamEditorControlItem>
    );
  }

  const picker = (
    <ColorPicker.Root
      value={parseColor(value.hex)}
      open={open}
      onOpenChange={(details: { open: boolean }) => setOpen(details.open)}
      onInteractOutside={() => setOpen(false)}
      onValueChange={(details: ColorPickerValueChangeDetails) =>
        commit({ ...value, hex: details.value.toString("hex") })
      }
      size="sm"
      width="100%"
    >
      <ColorPicker.HiddenInput />
      <ColorPicker.Label srOnly>{name}</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Input />
        <ColorPicker.Trigger />
      </ColorPicker.Control>
      <ColorPicker.Positioner>
        <ColorPicker.Content>
          <ColorPicker.Area />
          <ColorPicker.Sliders />
        </ColorPicker.Content>
      </ColorPicker.Positioner>
    </ColorPicker.Root>
  );

  const opacity = (
    <Flex alignItems="center" gap="xs">
      <Slider
        size="sm"
        flex="1"
        value={[value.opacity]}
        min={0}
        max={100}
        onValueChange={(details: SliderValueChangeDetails) =>
          setValue({ ...value, opacity: clampToRange(details.value[0], 0, 100) })
        }
        onValueChangeEnd={(details: SliderValueChangeDetails) =>
          commit({ ...value, opacity: clampToRange(details.value[0], 0, 100) })
        }
      />
      <Text textStyle="label/XS/regular" color="fg.muted" width="2.5rem" textAlign="right" flexShrink={0}>
        {value.opacity}%
      </Text>
    </Flex>
  );

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked">
      <Stack gap="xs">
        {picker}
        {opacity}
      </Stack>
    </ParamEditorControlItem>
  );
};
