import { Box, ColorPicker, type ColorPickerValueChangeDetails, Flex, parseColor } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { ParamEditorLabel } from "./param-editor-label";

interface ColorInputProps {
  id: string;
  defaultValue: string;
  name: string;
  onChange: (id: string, value: string) => void;
  description: string;
  readOnly?: boolean;
  hideLabel?: boolean;
  tooltipPlacement?: "top" | "right" | "bottom" | "left";
  fullWidth?: boolean;
}

export const ColorInput = (props: ColorInputProps) => {
  const { id, defaultValue, name, onChange, description, readOnly, hideLabel = false, fullWidth = false } = props;
  const [value, setValue] = useState(defaultValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleChange = (nextColor: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(id, nextColor), 540);
  };

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const handleChange = (newColor: string) => {
    setValue(newColor);
    scheduleChange(newColor);
  };

  const rootProps = {
    value: parseColor(value),
    onValueChange: (details: ColorPickerValueChangeDetails) => handleChange(details.value.toString("hex")),
    disabled: readOnly,
  };

  const picker = (
    <ColorPicker.Root {...rootProps} size="sm" maxW={fullWidth ? "100%" : "8.75rem"}>
      <ColorPicker.HiddenInput />
      <ColorPicker.Label srOnly>{name}</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Input readOnly={readOnly} />
        <ColorPicker.Trigger />
      </ColorPicker.Control>
      <ColorPicker.Positioner>
        <ColorPicker.Content>
          <ColorPicker.Area />
          <ColorPicker.Sliders />
          <ColorPicker.SwatchGroup>
            <ColorPicker.SwatchTrigger value={value}>
              <ColorPicker.Swatch value={value} />
            </ColorPicker.SwatchTrigger>
          </ColorPicker.SwatchGroup>
        </ColorPicker.Content>
      </ColorPicker.Positioner>
    </ColorPicker.Root>
  );

  return (
    <Box>
      {fullWidth ? (
        <Box>
          {!hideLabel && (
            <Box mb="xs">
              <ParamEditorLabel name={name} description={description} />
            </Box>
          )}
          {picker}
        </Box>
      ) : (
        <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
          {!hideLabel && <ParamEditorLabel name={name} description={description} />}
          {picker}
        </Flex>
      )}
    </Box>
  );
};
