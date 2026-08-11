import { Box, Flex, Input, Textarea } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { ParamEditorLabel } from "../param-editor-label";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";

interface HorizontalTextInputProps {
  id: string;
  defaultValue: string;
  name: string;
  onChange: (id: string, value: string) => void;
  description: string;
  readOnly?: boolean;
  hideLabel?: boolean;
  tooltipPlacement?: "top" | "right" | "bottom" | "left";
  size?: "xs" | "sm";
}

export const HorizontalTextInput = (props: HorizontalTextInputProps) => {
  const { id, defaultValue, name, onChange, description, readOnly, hideLabel = false, size = "sm" } = props;
  const [value, setValue] = useState(defaultValue);
  const [isExpanded, setIsExpanded] = useState(false);
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

  const handleClick = () => {
    if (!readOnly) {
      setIsExpanded(true);
    }
  };

  const handleBlur = () => {
    // Only collapse if the value is empty
    if (value.trim().length === 0) {
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow users to collapse with Escape key
    if (e.key === "Escape") {
      setIsExpanded(false);
      e.preventDefault();
    }
  };

  if (readOnly) {
    return (
      <Box position="relative" flex="1" minW="12.5rem">
        <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
          {!hideLabel && <ParamEditorLabel name={name} description={description} />}
          <ParamEditorReadOnlyValue preserveWhitespace>{value}</ParamEditorReadOnlyValue>
        </Flex>
      </Box>
    );
  }

  return (
    <Box position="relative" flex="1" minW="12.5rem">
      <Box position="relative" minHeight="2rem">
        {!isExpanded ? (
          <Flex alignItems="center" justifyContent="space-between" height="2rem" gap="xs">
            {!hideLabel && <ParamEditorLabel name={name} description={description} />}
            <Input
              className="nodrag"
              readOnly={readOnly}
              flex="1"
              maxW="12.5rem"
              size={size}
              type="text"
              placeholder={hideLabel ? name : undefined}
              value={value}
              onClick={handleClick}
              onChange={(e) => handleChange(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
          </Flex>
        ) : (
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            zIndex="10"
            bg="bg"
            borderWidth="1px"
            borderStyle="solid"
            borderColor="border"
            borderRadius="lg"
            p="2"
            transition="border-color 0.2s ease-in-out"
            boxShadow="none"
            _hover={{ borderColor: "border.accent-light" }}
            _active={{ borderColor: "border.accent-light" }}
            _focusWithin={{ borderColor: "border.accent-light", boxShadow: "none" }}
          >
            {!hideLabel && (
              <Box mb="sm">
                <ParamEditorLabel name={name} description={description} />
              </Box>
            )}
            <Textarea
              className="nodrag"
              readOnly={readOnly}
              width="100%"
              size={size}
              placeholder={hideLabel ? name : undefined}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              rows={3}
              resize="vertical"
              autoFocus
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
