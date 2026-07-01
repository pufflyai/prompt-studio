import { Box, Button, Group } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { SegmentedOption } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";

interface SegmentedInputProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: string;
  options: SegmentedOption[];
  variant?: "default" | "dots";
  onChange: (id: string, value: string) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

export const SegmentedInput = (props: SegmentedInputProps) => {
  const { id, name, description, defaultValue, options, variant = "default", onChange, readOnly, fullWidth } = props;
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const select = (next: string) => {
    setValue(next);
    onChange(id, next);
  };

  const selectedName = options.find((option) => option.id === value)?.name ?? value;

  if (readOnly) {
    return (
      <ParamEditorControlItem name={name} description={description} fullWidth={fullWidth}>
        <ParamEditorReadOnlyValue>{selectedName}</ParamEditorReadOnlyValue>
      </ParamEditorControlItem>
    );
  }

  const group = (
    <Group
      attached
      width="full"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xs"
      overflow="hidden"
      transition="border-color 0.2s ease-in-out"
      _hover={{ borderColor: "border.accent-light" }}
      _active={{ borderColor: "border.accent-light" }}
      _focusWithin={{ borderColor: "border.accent-light", boxShadow: "none" }}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Button
            key={option.id}
            flex="1"
            size="xs"
            variant={selected ? "subtle" : "ghost"}
            borderRadius="0"
            aria-pressed={selected}
            onClick={() => select(option.id)}
          >
            {variant === "dots" ? (
              <Box boxSize="0.5rem" borderRadius="full" bg={option.indicatorColor ?? "fg.muted"} mr="1" />
            ) : null}
            {option.name}
          </Button>
        );
      })}
    </Group>
  );

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked">
      {group}
    </ParamEditorControlItem>
  );
};
