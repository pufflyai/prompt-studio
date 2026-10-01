import { Box, Button, Flex, HStack, Spacer, Text } from "@chakra-ui/react";
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
  buildSkippedQuestionResponse,
  type ChatInputQuestionPrompt,
  type ChatInputQuestionResponse,
  QuestionPromptControls,
  SKIPPED_QUESTION_TEXT,
} from "./chat-input-question-prompt";
import { COMPOSER_CONTROL_HEIGHT } from "./composer-constants";
import { SendButton } from "./send-button";

import { useChatInputHistory } from "./use-chat-input-history";
import { useQuestionPromptState } from "./use-question-prompt-state";

export interface ChatInputProps {
  defaultState: string;
  /** Plain-text prompts from the active conversation, newest first. */
  recentUserMessages?: string[];
  placeholder?: string;
  onSubmit?: (
    text: string,
    attachments: string[],
    questionResponse?: ChatInputQuestionResponse,
  ) => void | Promise<void>;
  onInterrupt?: () => void;
  onAttachFiles?: (files: File[]) => void;
  onAttachText?: (text: string) => void;
  textAttachmentPasteLineThreshold?: number;
  streaming?: boolean;
  attachedResources?: string[];
  onClearAttachments?: () => void;
  isDisabled?: boolean;
  /** Keeps the editor usable but blocks sending, for example while no model is selected. */
  submitDisabled?: boolean;
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

const useComposerFocus = (
  containerRef: { current: HTMLDivElement | null },
  autoFocus: boolean,
  focusSignal: number,
  setIsSelected: (selected: boolean) => void,
) => {
  useEffect(() => {
    if (!autoFocus) return;
    const handle = requestPromptEditorFocus(containerRef.current, () => setIsSelected(true));
    return () => cancelAnimationFrame(handle);
  }, [autoFocus, containerRef, setIsSelected]);

  useEffect(() => {
    if (focusSignal === 0) return;
    const handle = requestPromptEditorFocus(containerRef.current, () => setIsSelected(true));
    return () => cancelAnimationFrame(handle);
  }, [focusSignal, containerRef, setIsSelected]);
};

export const ChatInput = (props: ChatInputProps) => {
  const {
    defaultState,
    recentUserMessages = [],
    onSubmit = () => {},
    onInterrupt,
    onAttachFiles,
    onAttachText,
    textAttachmentPasteLineThreshold = DEFAULT_TEXT_ATTACHMENT_PASTE_LINE_THRESHOLD,
    streaming = false,
    attachedResources = [],
    onClearAttachments,
    isDisabled = false,
    submitDisabled = false,
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
  const [submitting, setSubmitting] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [editorState, setEditorState] = useState(defaultState);
  const [editorKey, setEditorKey] = useState(0);
  const [text, setText] = useState(() => getTextFromSerializedEditorState(defaultState));
  const question = useQuestionPromptState(questionPrompt, defaultState);
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

  useComposerFocus(containerRef, autoFocus, focusSignal, setIsSelected);

  const history = useChatInputHistory({
    recentUserMessages,
    text,
    blocked: isDisabled || submitting || Boolean(questionPrompt),
    resetKey: JSON.stringify([defaultState, editorKey, question.signature]),
    onChange: (value) => {
      setText(value);
      onChange?.(value);
    },
  });

  const handleContainerClick = () => {
    setIsSelected(true);
    focusPromptEditor(containerRef.current);
  };

  const resetEditor = (shouldFocus = false) => {
    question.reset();
    history.reset();
    // Answering a question leaves the message draft ready for the person to keep editing.
    if (!questionPrompt) {
      setEditorKey((key) => key + 1);
      setEditorState(defaultState);
      history.change(getTextFromSerializedEditorState(defaultState));
    }

    if (shouldFocus) {
      requestAnimationFrame(() => {
        focusPromptEditor(containerRef.current);
      });
    }
  };

  const responseText = questionPrompt ? question.responseText : text.trim();
  const hasMissingRequiredSelection = question.hasMissingRequiredAnswer;
  const actionState = {
    canInterrupt: streaming && !questionPrompt && Boolean(onInterrupt),
    canSubmit: !submitDisabled,
    hasQuestionPrompt: Boolean(questionPrompt),
    isDisabled: isDisabled || submitting || hasMissingRequiredSelection,
    streaming,
    text: responseText,
  };
  const buttonAction = resolveChatInputButtonAction(actionState);
  const messageTitle = streaming && !questionPrompt ? "Queue message" : "Send message";
  const submitMessage = async () => {
    if (!responseText) return;

    const questionResponse = questionPrompt ? { answers: question.buildAnswers() } : undefined;

    history.reset();
    setSubmitting(true);
    try {
      await onSubmit(responseText, attachedResources, questionResponse);
      resetEditor(true);
      onClearAttachments?.();
    } catch {
      // Keep the composer intact so failed submissions can be retried.
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = (action: ChatInputAction) => {
    if (action === "interrupt") onInterrupt?.();
    if (action === "submit") void submitMessage();
  };

  const attachmentEventHandlers = createAttachmentEventHandlers({
    onAttachFiles,
    onAttachText,
    textAttachmentPasteLineThreshold,
  });

  const skipQuestion = async () => {
    setSubmitting(true);
    try {
      await onSubmit(SKIPPED_QUESTION_TEXT, attachedResources, buildSkippedQuestionResponse());
      resetEditor(true);
      onClearAttachments?.();
    } catch {
      // Keep the form intact so a failed skip can be retried.
    } finally {
      setSubmitting(false);
    }
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
            selectedOptionsByQuestion={question.selectedOptionsByQuestion}
            customAnswersByQuestion={question.customAnswersByQuestion}
            onToggleOption={question.toggleOption}
            onToggleOther={question.toggleOther}
            onCustomAnswerChange={question.setCustomAnswer}
          />
        ) : (
          // The editor is its own composer row: it centres a single line at the shared
          // control height and grows with content, never shrinking below it, so the row
          // aligns with the toolbar beneath it.
          <ScrollArea maxH="10rem" showHorizontalScrollbar={false} contentProps={{ pr: "2xs" }}>
            <Flex minH={COMPOSER_CONTROL_HEIGHT} align="center">
              <PromptEditor
                key={editorKey}
                ref={history.editorRef}
                onRecallPrevious={history.recallPrevious}
                onRecallNext={history.recallNext}
                defaultState={editorState}
                isEditable={!isDisabled && !submitting}
                placeholder={<ChatInputPlaceholder placeholder={placeholder} />}
                onChange={(nextText, state) => {
                  setEditorState(JSON.stringify(state));
                  history.change(nextText);
                }}
                onSubmit={() => runAction(resolveChatInputKeyboardAction(actionState))}
                references={references}
                onAddReference={onAddReference}
              />
            </Flex>
          </ScrollArea>
        )}
        <HStack gap="1" minH={COMPOSER_CONTROL_HEIGHT} align="center">
          {actions}
          <Spacer />
          {questionPrompt ? (
            <Button
              size="xs"
              variant="ghost"
              disabled={isDisabled || submitting || submitDisabled}
              title="Skip this question and let the agent continue"
              onClick={() => void skipQuestion()}
            >
              Skip
            </Button>
          ) : null}
          <SendButton
            canInterrupt={buttonAction === "interrupt"}
            title={buttonAction === "interrupt" ? "Stop Response" : (submitTitle ?? messageTitle)}
            shortcut={buttonAction === "submit" ? "Enter" : undefined}
            onClick={() => runAction(buttonAction)}
            disabled={buttonAction === "none"}
          />
        </HStack>
      </Flex>
    </Box>
  );
};
