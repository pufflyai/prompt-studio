import { Box, Flex, Input, Text, Textarea } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "./tooltip";

interface TextInputProps {
  id: string;
  defaultValue: string;
  name: string;
  onChange: (id: string, value: string) => void;
  description: string;
  readOnly?: boolean;
  singleLine?: boolean;
  hideLabel?: boolean;
  fullWidth?: boolean;
}

export const TextInput = (props: TextInputProps) => {
  const {
    id,
    defaultValue,
    name,
    onChange,
    description,
    readOnly,
    singleLine = true,
    hideLabel = false,
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
      <Tooltip positioning={{ placement: "right" }} content={description} contentProps={{ padding: "xxs" }}>
        {singleLine && !fullWidth ? (
          <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" mb="sm">
            {!hideLabel && (
              <Text mr="xs" textStyle="label/S/medium" color="fg.muted">
                {name}
              </Text>
            )}
            <Input
              className="nodrag"
              readOnly={readOnly}
              flex="1"
              maxW="12.5rem"
              size="sm"
              type="text"
              placeholder={hideLabel ? name : undefined}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
          </Flex>
        ) : (
          <Box>
            {!hideLabel && (
              <Text textStyle="label/S/medium" color="fg.muted" mb="xs">
                {name}
              </Text>
            )}
            {singleLine ? (
              <Input
                className="nodrag"
                readOnly={readOnly}
                width="100%"
                size="sm"
                type="text"
                placeholder={hideLabel ? name : undefined}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                onKeyUp={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <Textarea
                className="nodrag"
                readOnly={readOnly}
                width="100%"
                size="sm"
                placeholder={hideLabel ? name : undefined}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                rows={3}
                resize="vertical"
              />
            )}
          </Box>
        )}
      </Tooltip>
    </Box>
  );
};
