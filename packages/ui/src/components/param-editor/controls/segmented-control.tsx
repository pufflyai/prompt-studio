import { Box, Button, Flex } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { SegmentedOption } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";

interface SegmentedControlProps {
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

export const SegmentedControl = (props: SegmentedControlProps) => {
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
    <Flex borderWidth="1px" borderColor="border" borderRadius="sm" overflow="hidden" width="full">
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <Button
            key={option.id}
            flex="1"
            size="xs"
            variant={selected ? "subtle" : "ghost"}
            borderRadius="0"
            borderLeftWidth={index === 0 ? "0" : "1px"}
            borderColor="border"
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
    </Flex>
  );

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked">
      {group}
    </ParamEditorControlItem>
  );
};
