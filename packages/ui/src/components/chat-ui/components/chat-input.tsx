import { Box, Flex, HStack, Spacer, Text } from "@chakra-ui/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { getTextFromSerializedEditorState, PromptEditor } from "../../rich-text";
import { SendButton } from "./send-button";

interface ChatInputProps {
  defaultState: string;
  placeholder?: string;
  onSubmit?: (text: string, attachments: string[]) => void;
  onInterrupt?: () => void;
  streaming?: boolean;
  attachedResources?: string[];
  onClearAttachments?: () => void;
  isDisabled?: boolean;
  onChange?: (text: string) => void;
  attachmentList?: ReactNode;
  actions?: ReactNode;
}

export const ChatInput = (props: ChatInputProps) => {
  const {
    defaultState,
    onSubmit = () => {},
    onInterrupt,
    streaming = false,
    attachedResources = [],
    onClearAttachments,
    isDisabled = false,
    onChange,
    placeholder,
    attachmentList,
    actions,
  } = props;

  const [isSelected, setIsSelected] = useState(false);
  const [editorState, setEditorState] = useState(defaultState);
  const [editorKey, setEditorKey] = useState(0);
  const [text, setText] = useState(() => getTextFromSerializedEditorState(defaultState));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const resetText = getTextFromSerializedEditorState(defaultState);
    setEditorState(defaultState);
    setEditorKey((key) => key + 1);
    setText(resetText);
    onChangeRef.current?.(resetText);
  }, [defaultState]);

  const focusEditor = () => {
    const editable = containerRef.current?.querySelector('[contenteditable="true"]');
    if (editable instanceof HTMLElement) {
      editable.focus();
    }
  };

  const handleContainerClick = () => {
    setIsSelected(true);
    focusEditor();
  };

  const resetEditor = (shouldFocus = false) => {
    setEditorState(defaultState);
    setEditorKey((key) => key + 1);
    const resetText = getTextFromSerializedEditorState(defaultState);
    setText(resetText);
    onChangeRef.current?.(resetText);

    if (shouldFocus) {
      requestAnimationFrame(() => {
        focusEditor();
      });
    }
  };

  const handleSend = () => {
    if (isDisabled) return;

    if (streaming) {
      onInterrupt?.();
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    onSubmit(trimmed, attachedResources);

    resetEditor(true);

    onClearAttachments?.();
  };

  const canInterrupt = streaming && Boolean(onInterrupt);

  const placeholderNode = placeholder ? (
    <Text textStyle="label/M/regular" color="fg.subtle" pointerEvents="none" position="absolute" top="0">
      {placeholder}
    </Text>
  ) : undefined;

  return (
    <Box
      ref={containerRef}
      width="100%"
      paddingX="lg"
      paddingY="md"
      bg="bg"
      borderRadius="md"
      borderWidth="1px"
      borderStyle="solid"
      borderColor={isSelected ? "blue.border" : "border.muted"}
      boxShadow={isSelected ? "mid" : "low"}
      transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
      _hover={{
        borderColor: isSelected ? "blue.border" : "border",
        boxShadow: "mid",
      }}
      _focusWithin={{
        borderColor: "blue.border",
        boxShadow: "mid",
      }}
      onClick={handleContainerClick}
      onBlur={() => setIsSelected(false)}
    >
      <Flex direction="column" color="fg">
        {attachmentList}
        <Box maxH="10rem" overflowY="auto">
          <PromptEditor
            key={editorKey}
            defaultState={editorState}
            isEditable={!isDisabled}
            placeholder={placeholderNode}
            onChange={(t) => {
              setText(t);
              onChange?.(t);
            }}
            onSubmit={handleSend}
          />
        </Box>
        <HStack gap="1" mt="md">
          {actions}
          <Spacer />
          <SendButton
            canInterrupt={canInterrupt}
            title={canInterrupt ? "Stop Response" : "Message Sending"}
            shortcut={streaming ? undefined : "Enter"}
            onClick={handleSend}
            disabled={(streaming && !canInterrupt) || (!streaming && !text.trim()) || isDisabled}
          />
        </HStack>
      </Flex>
    </Box>
  );
};
