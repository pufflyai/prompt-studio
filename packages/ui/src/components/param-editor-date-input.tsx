import { Box, Flex, Input, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "./tooltip";

interface DateInputProps {
  id: string;
  defaultValue: string;
  name: string;
  min?: string;
  max?: string;
  onChange: (id: string, value: string) => void;
  description: string;
  readOnly?: boolean;
  hideLabel?: boolean;
  tooltipPlacement?: "top" | "right" | "bottom" | "left";
  fullWidth?: boolean;
}

export const DateInput = (props: DateInputProps) => {
  const {
    id,
    defaultValue,
    name,
    min,
    max,
    onChange,
    description,
    readOnly,
    hideLabel = false,
    tooltipPlacement = "right",
    fullWidth = false,
  } = props;
  const [value, setValue] = useState(defaultValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleChange = (nextValue: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(id, nextValue), 540);
  };

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    scheduleChange(newValue);
  };

  return (
    <Box>
      <Tooltip positioning={{ placement: tooltipPlacement }} content={description} contentProps={{ padding: "xxs" }}>
        {fullWidth ? (
          <Box>
            {!hideLabel && (
              <Text textStyle="label/S/medium" color="fg.muted" mb="xs">
                {name}
              </Text>
            )}
            <Input
              className="nodrag"
              readOnly={readOnly}
              width="100%"
              size="sm"
              type="date"
              placeholder={hideLabel ? name : undefined}
              value={value}
              min={min}
              max={max}
              onChange={(e) => handleChange(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
          </Box>
        ) : (
          <Flex alignItems="center" justifyContent="space-between" minHeight="2rem">
            {!hideLabel && (
              <Text textStyle="label/S/medium" color="fg.muted">
                {name}
              </Text>
            )}
            <Input
              className="nodrag"
              readOnly={readOnly}
              width="8.75rem"
              size="sm"
              type="date"
              placeholder={hideLabel ? name : undefined}
              value={value}
              min={min}
              max={max}
              onChange={(e) => handleChange(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
          </Flex>
        )}
      </Tooltip>
    </Box>
  );
};
