import { Box, Flex, Input, Stack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { LazyMarkdownEditor } from "@/components/rich-text";
import { ParamEditorFieldLabel } from "../param-editor-field-label";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";

interface MarkdownInputProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: string;
  placeholder?: string;
  onChange: (id: string, value: string) => void;
  readOnly?: boolean;
  presentation?: "stacked" | "horizontal";
  size?: "xs" | "sm";
}

export const MarkdownInput = (props: MarkdownInputProps) => {
  const {
    id,
    name,
    description,
    defaultValue,
    placeholder,
    onChange,
    readOnly,
    presentation = "stacked",
    size = "sm",
  } = props;
  const [value, setValue] = useState(defaultValue);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const commit = (next: string) => {
    setValue(next);
    onChange(id, next);
  };

  const editor = (editorValue: string) => (
    <Box borderWidth="1px" borderColor="border" borderRadius="xs" minH="7rem" minW="0" overflow="visible" width="full">
      <LazyMarkdownEditor
        defaultState={editorValue}
        isEditable={!readOnly}
        placeholder={placeholder}
        scrollable={false}
        onChange={commit}
      />
    </Box>
  );
  const label = <ParamEditorFieldLabel name={name} description={description} />;

  if (presentation === "horizontal") {
    if (readOnly) {
      return (
        <Box position="relative" flex="1" minW="12.5rem">
          <Flex alignItems="center" minHeight="2rem">
            <ParamEditorReadOnlyValue preserveWhitespace>{value}</ParamEditorReadOnlyValue>
          </Flex>
        </Box>
      );
    }

    return (
      <Box position="relative" flex="1" minW="12.5rem">
        <Box position="relative" minHeight="2rem">
          {!isExpanded ? (
            <Input
              className="nodrag"
              flex="1"
              maxW="12.5rem"
              size={size}
              type="text"
              placeholder={name}
              value={value}
              onClick={() => {
                setIsExpanded(true);
              }}
              onChange={(event) => commit(event.target.value)}
            />
          ) : (
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              zIndex="10"
              bg="bg"
              borderWidth="1px"
              borderColor="border"
              borderRadius="lg"
              p="2"
              transition="border-color 0.2s ease-in-out"
              _hover={{ borderColor: "border.accent-light" }}
              _focusWithin={{ borderColor: "border.accent-light" }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsExpanded(false);
                  event.preventDefault();
                }
              }}
            >
              {editor(value)}
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Stack gap="xs" minW="0" width="full">
      {label}
      {editor(value)}
    </Stack>
  );
};
