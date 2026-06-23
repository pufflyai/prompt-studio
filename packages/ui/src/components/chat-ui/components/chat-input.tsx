import { Box, Flex, HStack, Spacer, Text } from "@chakra-ui/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/scroll-area";
import { getTextFromSerializedEditorState, PromptEditor } from "../../rich-text";
import {
  type ChatInputAction,
  resolveChatInputButtonAction,
  resolveChatInputKeyboardAction,
} from "./chat-input-actions";
import { createAttachmentEventHandlers, DEFAULT_TEXT_ATTACHMENT_PASTE_LINE_THRESHOLD } from "./chat-input-attachments";
import {
  buildQuestionAnswerValues,
  buildQuestionResponse,
  type ChatInputQuestion,
  type ChatInputQuestionCustomAnswers,
  type ChatInputQuestionPrompt,
  type ChatInputQuestionResponse,
  getQuestionPromptSignature,
  getQuestionSelectionKey,
  hasMissingRequiredQuestionAnswer,
  QuestionPromptControls,
} from "./chat-input-question-prompt";
import { SendButton } from "./send-button";

interface ChatInputProps {
  defaultState: string;
  placeholder?: string;
  onSubmit?: (text: string, attachments: string[], questionResponse?: ChatInputQuestionResponse) => void;
  onInterrupt?: () => void;
  onAttachFiles?: (files: File[]) => void;
  onAttachText?: (text: string) => void;
  textAttachmentPasteLineThreshold?: number;
  streaming?: boolean;
  attachedResources?: string[];
  onClearAttachments?: () => void;
  isDisabled?: boolean;
  onChange?: (text: string) => void;
  attachmentList?: ReactNode;
  actions?: ReactNode;
  attachedToTop?: boolean;
  questionPrompt?: ChatInputQuestionPrompt;
  autoFocus?: boolean;
}

const ChatInputPlaceholder = (props: { placeholder?: string }) => {
  const { placeholder } = props;
  if (!placeholder) return null;

  return (
    <Text textStyle="label/M/regular" color="fg.subtle" pointerEvents="none" position="absolute" top="0">
      {placeholder}
    </Text>
  );
};

export const ChatInput = (props: ChatInputProps) => {
  const {
    defaultState,
    onSubmit = () => {},
    onInterrupt,
    onAttachFiles,
    onAttachText,
    textAttachmentPasteLineThreshold = DEFAULT_TEXT_ATTACHMENT_PASTE_LINE_THRESHOLD,
    streaming = false,
    attachedResources = [],
    onClearAttachments,
    isDisabled = false,
    onChange,
    placeholder,
    attachmentList,
    actions,
    attachedToTop = false,
    questionPrompt,
    autoFocus = false,
  } = props;

  const [isSelected, setIsSelected] = useState(false);
  const [editorState, setEditorState] = useState(defaultState);
  const [editorKey, setEditorKey] = useState(0);
  const [text, setText] = useState(() => getTextFromSerializedEditorState(defaultState));
  const [selectedOptionsByQuestion, setSelectedOptionsByQuestion] = useState<Record<string, string[]>>({});
  const [customAnswersByQuestion, setCustomAnswersByQuestion] = useState<ChatInputQuestionCustomAnswers>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const previousQuestionPromptSignatureRef = useRef(getQuestionPromptSignature(questionPrompt));

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const resetText = getTextFromSerializedEditorState(defaultState);
    setEditorState(defaultState);
    setEditorKey((key) => key + 1);
    setText(resetText);
    setSelectedOptionsByQuestion({});
    setCustomAnswersByQuestion({});
    onChangeRef.current?.(resetText);
  }, [defaultState]);

  const questionPromptSignature = getQuestionPromptSignature(questionPrompt);

  useEffect(() => {
    if (previousQuestionPromptSignatureRef.current === questionPromptSignature) return;
    previousQuestionPromptSignatureRef.current = questionPromptSignature;
    setSelectedOptionsByQuestion({});
    setCustomAnswersByQuestion({});
  }, [questionPromptSignature]);

  const focusEditor = () => {
    const editable = containerRef.current?.querySelector('[contenteditable="true"]');
    if (editable instanceof HTMLElement) {
      editable.focus();
    }
  };

  useEffect(() => {
    if (!autoFocus) return;
    const handle = requestAnimationFrame(() => {
      const editable = containerRef.current?.querySelector('[contenteditable="true"]');
      if (editable instanceof HTMLElement) {
        editable.focus();
      }
      setIsSelected(true);
    });
    return () => cancelAnimationFrame(handle);
  }, [autoFocus]);

  const handleContainerClick = () => {
    setIsSelected(true);
    focusEditor();
  };

  const resetEditor = (shouldFocus = false) => {
    setEditorState(defaultState);
    setEditorKey((key) => key + 1);
    const resetText = getTextFromSerializedEditorState(defaultState);
    setText(resetText);
    setSelectedOptionsByQuestion({});
    setCustomAnswersByQuestion({});
    onChangeRef.current?.(resetText);

    if (shouldFocus) {
      requestAnimationFrame(() => {
        focusEditor();
      });
    }
  };

  const canInterrupt = streaming && Boolean(onInterrupt);
  const responseText = questionPrompt
    ? buildQuestionResponse(questionPrompt, selectedOptionsByQuestion, customAnswersByQuestion)
    : text.trim();
  const hasMissingRequiredSelection = hasMissingRequiredQuestionAnswer(
    questionPrompt,
    selectedOptionsByQuestion,
    customAnswersByQuestion,
  );
  const actionState = {
    canInterrupt,
    isDisabled: isDisabled || hasMissingRequiredSelection,
    streaming,
    text: responseText,
  };
  const buttonAction = resolveChatInputButtonAction(actionState);

  const submitMessage = () => {
    if (!responseText) return;

    const questionResponse = questionPrompt
      ? {
          answers: buildQuestionAnswerValues(questionPrompt, selectedOptionsByQuestion, customAnswersByQuestion),
        }
      : undefined;

    onSubmit(responseText, attachedResources, questionResponse);
    resetEditor(true);
    onClearAttachments?.();
  };

  const runAction = (action: ChatInputAction) => {
    if (action === "interrupt") {
      onInterrupt?.();
      return;
    }

    if (action === "submit") {
      submitMessage();
    }
  };

  const handleKeyboardSubmit = () => runAction(resolveChatInputKeyboardAction(actionState));

  const handleButtonClick = () => runAction(buttonAction);

  const attachmentEventHandlers = createAttachmentEventHandlers({
    onAttachFiles,
    onAttachText,
    textAttachmentPasteLineThreshold,
  });

  const toggleQuestionOption = (question: ChatInputQuestion, questionIndex: number, optionLabel: string) => {
    const key = getQuestionSelectionKey(question, questionIndex);

    setSelectedOptionsByQuestion((current) => {
      const selected = current[key] ?? [];
      const alreadySelected = selected.includes(optionLabel);

      if (question.multiple) {
        return {
          ...current,
          [key]: alreadySelected ? selected.filter((label) => label !== optionLabel) : [...selected, optionLabel],
        };
      }

      return {
        ...current,
        [key]: alreadySelected ? [] : [optionLabel],
      };
    });
  };

  const updateQuestionCustomAnswer = (question: ChatInputQuestion, questionIndex: number, answer: string) => {
    const key = getQuestionSelectionKey(question, questionIndex);
    setCustomAnswersByQuestion((current) => ({
      ...current,
      [key]: answer,
    }));
  };

  return (
    <Box
      ref={containerRef}
      position="relative"
      width="100%"
      paddingX="xs"
      paddingY="xs"
      mt={attachedToTop ? "-1px" : undefined}
      bg="bg"
      borderRadius="md"
      borderTopRadius={attachedToTop ? "0" : undefined}
      borderWidth="1px"
      borderStyle="solid"
      borderColor={isSelected ? "blue.border" : "border.muted"}
      boxShadow={isSelected ? "mid" : "low"}
      zIndex={isSelected ? 1 : 0}
      transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
      _hover={{
        borderColor: isSelected ? "blue.border" : "border",
        boxShadow: "mid",
        zIndex: 1,
      }}
      _focusWithin={{
        borderColor: "blue.border",
        boxShadow: "mid",
        zIndex: 1,
      }}
      onPasteCapture={attachmentEventHandlers.onPasteCapture}
      onDropCapture={attachmentEventHandlers.onDropCapture}
      onDragOver={attachmentEventHandlers.onDragOver}
      onClick={handleContainerClick}
      onBlur={() => setIsSelected(false)}
    >
      <Flex direction="column" color="fg">
        {attachmentList ? <Box mb="xs">{attachmentList}</Box> : null}
        {questionPrompt ? (
          <QuestionPromptControls
            questionPrompt={questionPrompt}
            selectedOptionsByQuestion={selectedOptionsByQuestion}
            customAnswersByQuestion={customAnswersByQuestion}
            onToggleOption={toggleQuestionOption}
            onCustomAnswerChange={updateQuestionCustomAnswer}
          />
        ) : (
          <ScrollArea maxH="10rem" showHorizontalScrollbar={false} contentProps={{ pr: "2xs" }}>
            <PromptEditor
              key={editorKey}
              defaultState={editorState}
              isEditable={!isDisabled}
              placeholder={<ChatInputPlaceholder placeholder={placeholder} />}
              onChange={(t) => {
                setText(t);
                onChange?.(t);
              }}
              onSubmit={handleKeyboardSubmit}
            />
          </ScrollArea>
        )}
        <HStack gap="1" mt="md">
          {actions}
          <Spacer />
          <SendButton
            canInterrupt={canInterrupt}
            title={canInterrupt ? "Stop Response" : "Message Sending"}
            shortcut={streaming ? undefined : "Enter"}
            onClick={handleButtonClick}
            disabled={buttonAction === "none"}
          />
        </HStack>
      </Flex>
    </Box>
  );
};
