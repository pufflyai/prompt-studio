import { Box, ColorPicker, type ColorPickerValueChangeDetails, Flex, parseColor } from "@chakra-ui/react";
import { type FocusEvent as ReactFocusEvent, useEffect, useRef, useState } from "react";
import { ParamEditorLabel } from "../param-editor-label";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";

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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleChange = (nextColor: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(id, nextColor), 540);
  };

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;

    const isInsidePicker = (target: EventTarget | null) => {
      const node = target as Node;
      return rootRef.current?.contains(node) || contentRef.current?.contains(node);
    };

    const handleOutsideInteraction = (event: FocusEvent | PointerEvent) => {
      if (isInsidePicker(event.target)) return;

      setOpen(false);
    };

    document.addEventListener("focusin", handleOutsideInteraction, true);
    document.addEventListener("pointerdown", handleOutsideInteraction, true);
    document.addEventListener("click", handleOutsideInteraction, true);

    return () => {
      document.removeEventListener("focusin", handleOutsideInteraction, true);
      document.removeEventListener("pointerdown", handleOutsideInteraction, true);
      document.removeEventListener("click", handleOutsideInteraction, true);
    };
  }, [open]);

  const handleChange = (newColor: string) => {
    setValue(newColor);
    scheduleChange(newColor);
  };

  const handleBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const root = event.currentTarget;

    setTimeout(() => {
      if (!root.contains(root.ownerDocument.activeElement)) setOpen(false);
    });
  };

  if (readOnly) {
    const valueElement = (
      <ParamEditorReadOnlyValue>
        <Flex alignItems="center" gap="xs">
          <Box boxSize="0.75rem" borderRadius="xs" bg={value} />
          <Box as="span">{value}</Box>
        </Flex>
      </ParamEditorReadOnlyValue>
    );

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

  const rootProps = {
    value: parseColor(value),
    open,
    onOpenChange: (details: { open: boolean }) => setOpen(details.open),
    onFocusOutside: () => setOpen(false),
    onInteractOutside: () => setOpen(false),
    onBlur: handleBlur,
    onValueChange: (details: ColorPickerValueChangeDetails) => handleChange(details.value.toString("hex")),
    disabled: readOnly,
  };

  const picker = (
    <ColorPicker.Root ref={rootRef} {...rootProps} size="sm" width={fullWidth ? "100%" : "8.75rem"} maxW="100%">
      <ColorPicker.HiddenInput />
      <ColorPicker.Label srOnly>{name}</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Input readOnly={readOnly} onFocus={() => setOpen(false)} />
        <ColorPicker.Trigger />
      </ColorPicker.Control>
      <ColorPicker.Positioner>
        <ColorPicker.Content ref={contentRef} onBlur={handleBlur}>
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
