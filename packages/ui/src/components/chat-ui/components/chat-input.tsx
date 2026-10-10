import { Box, Flex, Text } from "@chakra-ui/react";
import { type MouseEvent, type ReactNode, useRef, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { type PromptCommand, PromptEditor } from "../../rich-text";
import type { PromptSelectionSnapshot } from "../../rich-text/prompt-input/plugins/preserve-selection-plugin";
import { createSerializedPromptState } from "../utils/editor-state";
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
import { focusPromptEditor, useComposerFocus } from "./use-chat-input-focus";
import { useChatInputHistory } from "./use-chat-input-history";
import { useChatInputText } from "./use-chat-input-text";
import { useComposerRequest } from "./use-composer-request";

export interface ChatInputProps {
  /**
   * Serialized editor state for the text to show. The editor adopts it whenever its text differs
   * from what the editor shows, so a host can pass its live draft. It is never echoed to `onChange`.
   */
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
  /** Secondary actions immediately before the submit button. */
  submitActions?: ReactNode;
  /** Attachment controls shown only while editing a message draft. */
  attachmentActions?: ReactNode;
  attachedToTop?: boolean;
  /** Recede the resting border to border.subtle when nested inside a stronger shell (the workspace hub). */
  recessed?: boolean;
  questionPrompt?: ChatInputQuestionPrompt;
  decision?: ComposerDecision;
  autoFocus?: boolean;
  focusSignal?: number;
  submitTitle?: string;
  submitLabel?: string;
  initialSelection?: PromptSelectionSnapshot;
  onSelectionChange?: (selection: PromptSelectionSnapshot) => void;
  onEditorStateChange?: (text: string, state: string) => void;
  retainTextUntilAcknowledged?: boolean;
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
    submitActions,
    attachmentActions,
    attachedToTop = false,
    recessed = false,
    questionPrompt,
    decision,
    autoFocus = false,
    focusSignal = 0,
    submitTitle,
    submitLabel,
    initialSelection,
    onSelectionChange,
    onEditorStateChange,
    retainTextUntilAcknowledged = false,
    commands = [],
  } = props;

  const request = useComposerRequest(questionPrompt, decision);
  const occupied = Boolean(request);

  const restingBorderColor = recessed ? "border.subtle" : "border";
  const [submitting, setSubmitting] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const { editorKey, editorState, remountEditor, setEditorState, setText, text } = useChatInputText(defaultState);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const focusAfterSubmission = useComposerFocus(
    containerRef,
    autoFocus,
    !isDisabled && !submitting && !occupied,
    focusSignal,
    setIsSelected,
  );

  const history = useChatInputHistory({
    recentUserMessages,
    text,
    blocked: isDisabled || submitting || occupied,
    resetKey: String(editorKey),
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

  const replaceDraftText = (value: string) => {
    remountEditor(createSerializedPromptState(value));
    history.change(value);
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
    const sentText = text;
    history.reset();
    setSubmitting(true);
    // The conversation owns the message from the moment it is sent.
    if (!retainTextUntilAcknowledged) replaceDraftText("");
    try {
      await submitComposerResponse({ text: text.trim(), attachments: attachedResources, onSubmit, onClearAttachments });
    } catch {
      // A rejected handoff leaves the draft available for a retry.
      if (!retainTextUntilAcknowledged) replaceDraftText(sentText);
    } finally {
      setSubmitting(false);
      focusAfterSubmission();
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
                initialSelection={initialSelection}
                onSelectionChange={onSelectionChange}
                isEditable={!isDisabled && !submitting && !occupied}
                placeholder={<ChatInputPlaceholder placeholder={placeholder} />}
                onChange={(nextText, state) => {
                  setEditorState(JSON.stringify(state));
                  onEditorStateChange?.(nextText, JSON.stringify(state));
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
            actions={
              <>
                {attachmentActions}
                {actions}
              </>
            }
            questionPrompt={false}
            skipDisabled={false}
            skipTitle=""
            onSkip={() => {}}
            buttonAction={buttonAction}
            submitTitle={submitTitle}
            submitLabel={submitLabel}
            submitActions={submitActions}
            messageTitle={messageTitle}
            runAction={runAction}
          />
        ) : null}
      </Flex>
    </Box>
  );
};
