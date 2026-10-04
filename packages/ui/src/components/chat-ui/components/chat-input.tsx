import { Box, Flex, Text } from "@chakra-ui/react";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { getTextFromSerializedEditorState, type PromptCommand, PromptEditor } from "../../rich-text";
import {
  type ChatInputAction,
  resolveChatInputButtonAction,
  resolveChatInputKeyboardAction,
} from "./chat-input-actions";
import { createAttachmentEventHandlers, DEFAULT_TEXT_ATTACHMENT_PASTE_LINE_THRESHOLD } from "./chat-input-attachments";
import type { ChatInputQuestionPrompt, ChatInputQuestionResponse } from "./chat-input-question-prompt";
import { ChatInputToolbar } from "./chat-input-toolbar";
import { COMPOSER_CONTROL_HEIGHT } from "./composer-constants";
import { type ComposerDecision, submitComposerResponse } from "./composer-decision";
import { ComposerTakeover } from "./composer-takeover";
import { useChatInputHistory } from "./use-chat-input-history";
import { useComposerRequest } from "./use-composer-request";

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
  decision?: ComposerDecision;
  autoFocus?: boolean;
  focusSignal?: number;
  submitTitle?: string;
  commands?: PromptCommand[];
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
    decision,
    autoFocus = false,
    focusSignal = 0,
    submitTitle,
    commands = [],
  } = props;

  const request = useComposerRequest(questionPrompt, decision);
  const occupied = Boolean(request);

  const restingBorderColor = recessed ? "border.subtle" : "border";
  const [submitting, setSubmitting] = useState(false);
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

  useComposerFocus(containerRef, autoFocus, focusSignal, setIsSelected);

  const history = useChatInputHistory({
    recentUserMessages,
    text,
    blocked: isDisabled || submitting || occupied,
    resetKey: JSON.stringify([defaultState, editorKey]),
    onChange: (value) => {
      setText(value);
      onChange?.(value);
    },
  });

  const handleContainerClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    // Portaled controls bubble through React, but own their focus outside this box.
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
    if (target.closest("button, input, textarea, select, a, label, [role=button], [role=combobox]")) return;
    if (occupied) return;
    setIsSelected(true);
    focusPromptEditor(containerRef.current);
  };

  const resetEditor = (shouldFocus = false) => {
    history.reset();
    setEditorKey((key) => key + 1);
    setEditorState(defaultState);
    history.change(getTextFromSerializedEditorState(defaultState));

    if (shouldFocus) {
      requestAnimationFrame(() => {
        focusPromptEditor(containerRef.current);
      });
    }
  };

  const canSubmit = !isDisabled && !submitting && !submitDisabled && !occupied;
  const actionState = {
    canInterrupt: !occupied && Boolean(onInterrupt),
    canSubmit: !submitDisabled && !occupied,
    hasQuestionPrompt: occupied,
    isDisabled: isDisabled || submitting,
    streaming,
    text,
  };
  const buttonAction = resolveChatInputButtonAction(actionState);
  const messageTitle = streaming ? "Queue message" : "Send message";
  const submitMessage = async () => {
    if (!canSubmit || !text.trim()) return;
    history.reset();
    setSubmitting(true);
    try {
      await submitComposerResponse({ text: text.trim(), attachments: attachedResources, onSubmit, onClearAttachments });
      resetEditor(true);
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
      onPasteCapture={occupied ? undefined : attachmentEventHandlers.onPasteCapture}
      onDropCapture={occupied ? undefined : attachmentEventHandlers.onDropCapture}
      onDragOver={occupied ? undefined : attachmentEventHandlers.onDragOver}
      onClick={handleContainerClick}
      onBlur={() => setIsSelected(false)}
    >
      <Flex direction="column" color="fg" gap="xs">
        <ComposerTakeover
          request={request}
          question={questionPrompt}
          decision={decision}
          actions={actions}
          disabled={isDisabled}
          submitDisabled={submitDisabled}
          onSubmit={(answer, response) =>
            submitComposerResponse({
              text: answer,
              response,
              attachments: attachedResources,
              onSubmit,
              onClearAttachments,
            })
          }
        />
        {/* Keep the editor mounted so a takeover preserves selection, composition and undo history. */}
        <Box display={occupied ? "none" : undefined}>
          {attachmentList ? <Box mb="xs">{attachmentList}</Box> : null}
          <ScrollArea maxH="10rem" showHorizontalScrollbar={false} contentProps={{ pr: "2xs" }}>
            <Flex minH={COMPOSER_CONTROL_HEIGHT} align="center">
              <PromptEditor
                key={editorKey}
                ref={history.editorRef}
                onRecallPrevious={history.recallPrevious}
                onRecallNext={history.recallNext}
                defaultState={editorState}
                isEditable={!isDisabled && !submitting && !occupied}
                placeholder={<ChatInputPlaceholder placeholder={placeholder} />}
                onChange={(nextText, state) => {
                  setEditorState(JSON.stringify(state));
                  history.change(nextText);
                }}
                onSubmit={() => runAction(resolveChatInputKeyboardAction(actionState))}
                commands={commands}
              />
            </Flex>
          </ScrollArea>
        </Box>
        {!occupied ? (
          <ChatInputToolbar
            actions={actions}
            questionPrompt={false}
            skipDisabled={false}
            skipTitle=""
            onSkip={() => {}}
            buttonAction={buttonAction}
            submitTitle={submitTitle}
            messageTitle={messageTitle}
            runAction={runAction}
          />
        ) : null}
      </Flex>
    </Box>
  );
};
