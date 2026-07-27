import { Box, Flex, HStack, Spacer, Text } from "@chakra-ui/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { getTextFromSerializedEditorState, PromptEditor, type ReferenceItem } from "../../rich-text";
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
import { COMPOSER_CONTROL_HEIGHT } from "./composer-constants";
import { SendButton } from "./send-button";

export interface ChatInputProps {
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
  /** Recede the resting border to border.subtle when nested inside a stronger shell (the workspace hub). */
  recessed?: boolean;
  questionPrompt?: ChatInputQuestionPrompt;
  autoFocus?: boolean;
  focusSignal?: number;
  submitTitle?: string;
  references?: ReferenceItem[];
  onAddReference?: (resourceId: string, resourceType: ReferenceItem["resourceType"]) => void;
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

const selectedChatInputBorderColor = "border.accent-light";

const focusPromptEditor = (container: HTMLDivElement | null) => {
  const editable = container?.querySelector('[contenteditable="true"]');
  if (editable instanceof HTMLElement) editable.focus();
};

const requestPromptEditorFocus = (container: HTMLDivElement | null, onFocus?: () => void) =>
  requestAnimationFrame(() => {
    focusPromptEditor(container);
    onFocus?.();
  });

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
    recessed = false,
    questionPrompt,
    autoFocus = false,
    focusSignal = 0,
    submitTitle,
    references = [],
    onAddReference,
  } = props;

  const restingBorderColor = recessed ? "border.subtle" : "border";
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

  useEffect(() => {
    if (!autoFocus) return;
    const handle = requestPromptEditorFocus(containerRef.current, () => setIsSelected(true));
    return () => cancelAnimationFrame(handle);
  }, [autoFocus]);

  useEffect(() => {
    if (focusSignal === 0) return;
    const handle = requestPromptEditorFocus(containerRef.current, () => setIsSelected(true));
    return () => cancelAnimationFrame(handle);
  }, [focusSignal]);

  const handleContainerClick = () => {
    setIsSelected(true);
    focusPromptEditor(containerRef.current);
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
        focusPromptEditor(containerRef.current);
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
      borderRadius="xs"
      borderTopRadius={attachedToTop ? "0" : undefined}
      borderWidth="1px"
      borderStyle="solid"
      borderColor={isSelected ? selectedChatInputBorderColor : restingBorderColor}
      zIndex={isSelected ? 1 : 0}
      transition="border-color 0.2s ease-in-out"
      _hover={{
        borderColor: isSelected ? selectedChatInputBorderColor : restingBorderColor,
        zIndex: 1,
      }}
      _focusWithin={{
        borderColor: selectedChatInputBorderColor,
        zIndex: 1,
      }}
      onPasteCapture={attachmentEventHandlers.onPasteCapture}
      onDropCapture={attachmentEventHandlers.onDropCapture}
      onDragOver={attachmentEventHandlers.onDragOver}
      onClick={handleContainerClick}
      onBlur={() => setIsSelected(false)}
    >
      <Flex direction="column" color="fg" gap="xs">
        {attachmentList ? <Box>{attachmentList}</Box> : null}
        {questionPrompt ? (
          <QuestionPromptControls
            questionPrompt={questionPrompt}
            selectedOptionsByQuestion={selectedOptionsByQuestion}
            customAnswersByQuestion={customAnswersByQuestion}
            onToggleOption={toggleQuestionOption}
            onCustomAnswerChange={updateQuestionCustomAnswer}
          />
        ) : (
          // The editor is its own composer row: it centres a single line at the shared
          // control height and grows with content, never shrinking below it, so the row
          // aligns with the toolbar beneath it.
          <ScrollArea maxH="10rem" showHorizontalScrollbar={false} contentProps={{ pr: "2xs" }}>
            <Flex minH={COMPOSER_CONTROL_HEIGHT} align="center">
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
                references={references}
                onAddReference={onAddReference}
              />
            </Flex>
          </ScrollArea>
        )}
        <HStack gap="1" minH={COMPOSER_CONTROL_HEIGHT} align="center">
          {actions}
          <Spacer />
          <SendButton
            canInterrupt={canInterrupt}
            title={canInterrupt ? "Stop Response" : (submitTitle ?? "Send message")}
            shortcut={streaming ? undefined : "Enter"}
            onClick={handleButtonClick}
            disabled={buttonAction === "none"}
          />
        </HStack>
      </Flex>
    </Box>
  );
};
