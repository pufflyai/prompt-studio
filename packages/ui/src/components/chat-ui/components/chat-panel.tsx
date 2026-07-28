import { Flex, Stack } from "@chakra-ui/react";
import { MessageCircleIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { EmptyState } from "@/components/primitives/empty-state";
import type { ReferenceItem } from "@/components/rich-text";
import { resolveActiveQuestionPrompt } from "../tool-rendering/question-prompt";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatPrimitives } from "./ai-conversation";
import { AutoScroll } from "./auto-scroll";
import { ChatInput } from "./chat-input";
import type { ChatInputQuestionPrompt, ChatInputQuestionResponse } from "./chat-input-question-prompt";
import { ChatMessageList } from "./chat-message-list";
import {
  groupMessagesByTurn,
  normalizeChatMessagesForDisplay,
  type QueuedFollowUp,
  type SessionMessage,
} from "./message-types";
import { QueuedFollowUpList } from "./queued-follow-up-list";
import type { QueuedFollowUpMoveDirection } from "./queued-follow-up-list-state";
import { WorkingIndicator } from "./working-indicator";

interface QueuedFollowUpComposerInput {
  queuedFollowUps: QueuedFollowUp[];
  defaultValue: string;
  onChange?: (text: string) => void;
  onSubmit?: (text: string, attachments: string[], questionResponse?: ChatInputQuestionResponse) => void;
  onUpdate?: (itemId: string, prompt: string) => void;
}

interface ChatPanelComposerProps {
  actions?: ReactNode;
  attachedResources?: string[];
  attachmentList?: ReactNode;
  chatInputAutoFocus: boolean;
  chatInputPlaceholder: string;
  chatInputQuestionPrompt?: ChatInputQuestionPrompt;
  chatInputReferences: ReferenceItem[];
  hasWorkspaceHub: boolean;
  inputDisabled: boolean;
  onAttachFiles?: (files: File[]) => void;
  onAttachText?: (text: string) => void;
  onChatInputAddReference?: (resourceId: string, resourceType: ReferenceItem["resourceType"]) => void;
  onClearAttachments?: () => void;
  onInterrupt?: () => void;
  onQueuedFollowUpMove?: (itemId: string, direction: QueuedFollowUpMoveDirection, steps?: number) => void;
  onQueuedFollowUpRemove?: (itemId: string) => void;
  onQueuedFollowUpUpdate?: (itemId: string, prompt: string) => void;
  queuedComposer: ReturnType<typeof useQueuedFollowUpComposer>;
  queuedFollowUps: QueuedFollowUp[];
  streaming: boolean;
  workspaceHub?: ReactNode;
}

/** Full conversation shell for agent sessions, including messages, input, attachments, and host-provided slots. */
export interface ChatPanelProps {
  /** Stable conversation identity used to reset ready state when switching sessions. */
  conversationKey?: string;
  messages: SessionMessage[];
  loading?: boolean;
  streaming?: boolean;
  emptyStateTitle: string;
  emptyStateDescription: string;
  emptyStateContent?: ReactNode;
  loaderComponent?: ReactNode;
  chatInputPlaceholder: string;
  chatInputDefaultValue?: string;
  onSubmitMessage?: (text: string, attachments: string[], questionResponse?: ChatInputQuestionResponse) => void;
  onInterrupt?: () => void;
  onAttachFiles?: (files: File[]) => void;
  onAttachText?: (text: string) => void;
  onChatInputChange?: (text: string) => void;
  /** Extra controls rendered in the chat input toolbar (attach, model, params). */
  actions?: ReactNode;
  attachedResources?: string[];
  onClearAttachments?: () => void;
  attachmentList?: ReactNode;
  approvalPrompt?: ReactNode;
  /** Optional workspace status/control surface rendered above the conversation viewport. */
  workspaceHub?: ReactNode;
  workspaceInitializing?: boolean;
  inputDisabled?: boolean;
  chatInputQuestionPrompt?: ChatInputQuestionPrompt;
  chatInputAutoFocus?: boolean;
  queuedFollowUps?: QueuedFollowUp[];
  onQueuedFollowUpUpdate?: (itemId: string, prompt: string) => void;
  onQueuedFollowUpRemove?: (itemId: string) => void;
  onQueuedFollowUpMove?: (itemId: string, direction: QueuedFollowUpMoveDirection, steps?: number) => void;
  chatInputReferences?: ReferenceItem[];
  onChatInputAddReference?: (resourceId: string, resourceType: ReferenceItem["resourceType"]) => void;
}

const useQueuedFollowUpComposer = (input: QueuedFollowUpComposerInput) => {
  const { queuedFollowUps, defaultValue, onChange, onSubmit, onUpdate } = input;
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSeed, setEditSeed] = useState("");
  const [focusSignal, setFocusSignal] = useState(0);
  const inputValue = editingItemId ? editSeed : defaultValue;

  useEffect(() => {
    if (!editingItemId) return;
    if (queuedFollowUps.some((item) => item.id === editingItemId)) return;
    setEditingItemId(null);
    setEditSeed("");
  }, [editingItemId, queuedFollowUps]);

  const edit = (item: QueuedFollowUp) => {
    setEditingItemId(item.id);
    setEditSeed(item.prompt);
    setFocusSignal((signal) => signal + 1);
  };

  const change = (text: string) => {
    if (editingItemId) return;
    onChange?.(text);
  };

  const submit = (text: string, attachments: string[], questionResponse?: ChatInputQuestionResponse) => {
    if (editingItemId) {
      onUpdate?.(editingItemId, text);
      setEditingItemId(null);
      setEditSeed("");
      return;
    }

    onSubmit?.(text, attachments, questionResponse);
  };

  return { change, edit, editingItemId, focusSignal, inputValue, isEditing: Boolean(editingItemId), submit };
};

const ChatPanelComposer = (props: ChatPanelComposerProps) => {
  const {
    actions,
    attachedResources,
    attachmentList,
    chatInputAutoFocus,
    chatInputPlaceholder,
    chatInputQuestionPrompt,
    chatInputReferences,
    hasWorkspaceHub,
    inputDisabled,
    onAttachFiles,
    onAttachText,
    onChatInputAddReference,
    onClearAttachments,
    onInterrupt,
    onQueuedFollowUpMove,
    onQueuedFollowUpRemove,
    onQueuedFollowUpUpdate,
    queuedComposer,
    queuedFollowUps,
    streaming,
    workspaceHub,
  } = props;
  const hasQueuedFollowUps = queuedFollowUps.length > 0;

  return (
    <Stack px={hasWorkspaceHub ? "2xs" : "xs"} gap="0">
      {/* Concentric hierarchy: the hub shell owns the visible border so the session reads
          as living inside the workspace; the nested input recedes to border.subtle. */}
      <Stack
        gap={hasWorkspaceHub ? "2xs" : "0"}
        p={hasWorkspaceHub ? "2xs" : undefined}
        borderWidth={hasWorkspaceHub ? "1px" : undefined}
        borderColor={hasWorkspaceHub ? "border" : undefined}
        borderRadius={hasWorkspaceHub ? "sm" : undefined}
        bg={hasWorkspaceHub ? "bg.subtle" : undefined}
      >
        {workspaceHub}
        <QueuedFollowUpList
          items={queuedFollowUps}
          editingItemId={queuedComposer.editingItemId}
          onEdit={onQueuedFollowUpUpdate ? queuedComposer.edit : undefined}
          onRemove={onQueuedFollowUpRemove}
          onMove={onQueuedFollowUpMove}
        />
        <ChatInput
          placeholder={chatInputPlaceholder}
          defaultState={createSerializedPromptState(queuedComposer.inputValue)}
          streaming={streaming}
          onSubmit={queuedComposer.submit}
          onInterrupt={onInterrupt}
          onAttachFiles={onAttachFiles}
          onAttachText={onAttachText}
          onChange={queuedComposer.change}
          actions={actions}
          attachedResources={attachedResources}
          onClearAttachments={onClearAttachments}
          attachmentList={attachmentList}
          isDisabled={inputDisabled}
          attachedToTop={hasQueuedFollowUps}
          recessed={hasWorkspaceHub}
          questionPrompt={chatInputQuestionPrompt}
          autoFocus={chatInputAutoFocus}
          focusSignal={queuedComposer.focusSignal}
          submitTitle={queuedComposer.isEditing ? "Save queued follow-up" : undefined}
          references={chatInputReferences}
          onAddReference={onChatInputAddReference}
        />
      </Stack>
    </Stack>
  );
};

export const ChatPanel = (props: ChatPanelProps) => {
  const {
    conversationKey,
    messages,
    loading = false,
    streaming = false,
    emptyStateTitle,
    emptyStateDescription,
    emptyStateContent,
    loaderComponent,
    chatInputPlaceholder,
    chatInputDefaultValue = "",
    onSubmitMessage,
    onInterrupt,
    onAttachFiles,
    onAttachText,
    onChatInputChange,
    actions,
    attachedResources,
    onClearAttachments,
    attachmentList,
    approvalPrompt,
    workspaceHub,
    workspaceInitializing = false,
    inputDisabled = false,
    chatInputQuestionPrompt,
    chatInputAutoFocus = false,
    queuedFollowUps = [],
    onQueuedFollowUpUpdate,
    onQueuedFollowUpRemove,
    onQueuedFollowUpMove,
    chatInputReferences = [],
    onChatInputAddReference,
  } = props;

  const merged = normalizeChatMessagesForDisplay(messages, { streaming });
  const hasMessages = merged.length > 0;
  const messageListKey = conversationKey ?? merged[0]?.id;
  const messageListIdentity = hasMessages ? (messageListKey ?? "active-conversation") : null;
  const userMessageCount = merged.reduce((count, message) => count + (message.role === "user" ? 1 : 0), 0);
  const { groups, leadingResponses } = groupMessagesByTurn(merged);
  const [expandedStickyMessageIds, setExpandedStickyMessageIds] = useState(() => new Set<string>());
  const [readyMessageListKey, setReadyMessageListKey] = useState<string | null>(null);
  const showLoadingState = !hasMessages && loading;
  const defaultEmptyContent = (
    <EmptyState
      icon={<MessageCircleIcon size={48} strokeWidth={1.5} />}
      title={emptyStateTitle}
      description={emptyStateDescription}
    />
  );
  const emptyContent = showLoadingState ? loaderComponent : (emptyStateContent ?? defaultEmptyContent);
  const hasWorkspaceHub = Boolean(workspaceHub);
  const activeQuestionPrompt = chatInputQuestionPrompt ?? resolveActiveQuestionPrompt(messages);
  const hideActiveQuestionForms = Boolean(activeQuestionPrompt);
  const showThinkingIndicator = streaming && hasMessages && !workspaceInitializing && !activeQuestionPrompt;
  const isMessageViewportReady = !messageListIdentity || readyMessageListKey === messageListIdentity;
  const queuedComposer = useQueuedFollowUpComposer({
    queuedFollowUps,
    defaultValue: chatInputDefaultValue,
    onChange: onChatInputChange,
    onSubmit: onSubmitMessage,
    onUpdate: onQueuedFollowUpUpdate,
  });

  const toggleStickyMessageExpanded = (messageId: string) => {
    setExpandedStickyMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  };

  return (
    <Flex position="relative" direction="column" w="full" h="full" overflow="hidden">
      <ChatPrimitives.Root>
        <AutoScroll conversationKey={messageListKey ?? null} userMessageCount={userMessageCount} />
        <ChatPrimitives.Viewport visibility={isMessageViewportReady ? "visible" : "hidden"}>
          {hasMessages ? (
            <ChatMessageList
              key={messageListIdentity}
              leadingResponses={leadingResponses}
              groups={groups}
              streaming={streaming}
              hideActiveQuestionForms={hideActiveQuestionForms}
              expandedStickyMessageIds={expandedStickyMessageIds}
              onToggleStickyMessage={toggleStickyMessageExpanded}
              onReady={() => setReadyMessageListKey(messageListIdentity)}
            />
          ) : (
            emptyContent
          )}
        </ChatPrimitives.Viewport>
        {isMessageViewportReady ? <ChatPrimitives.ScrollToBottom aria-label="Scroll to latest message" /> : null}
      </ChatPrimitives.Root>
      {approvalPrompt}
      {streaming ? <WorkingIndicator hidden={!showThinkingIndicator} /> : null}
      <ChatPanelComposer
        actions={actions}
        attachedResources={attachedResources}
        attachmentList={attachmentList}
        chatInputAutoFocus={chatInputAutoFocus}
        chatInputPlaceholder={chatInputPlaceholder}
        chatInputQuestionPrompt={activeQuestionPrompt}
        chatInputReferences={chatInputReferences}
        hasWorkspaceHub={hasWorkspaceHub}
        inputDisabled={inputDisabled}
        onAttachFiles={onAttachFiles}
        onAttachText={onAttachText}
        onChatInputAddReference={onChatInputAddReference}
        onClearAttachments={onClearAttachments}
        onInterrupt={onInterrupt}
        onQueuedFollowUpMove={onQueuedFollowUpMove}
        onQueuedFollowUpRemove={onQueuedFollowUpRemove}
        onQueuedFollowUpUpdate={onQueuedFollowUpUpdate}
        queuedComposer={queuedComposer}
        queuedFollowUps={queuedFollowUps}
        streaming={streaming}
        workspaceHub={workspaceHub}
      />
    </Flex>
  );
};
