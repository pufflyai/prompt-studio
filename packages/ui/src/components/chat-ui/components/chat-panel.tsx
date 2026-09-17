import { Flex } from "@chakra-ui/react";
import { MessageCircleIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/primitives/empty-state";
import type { ReferenceItem } from "@/components/rich-text";
import { resolveActiveQuestionPrompt } from "../tool-rendering/question-prompt";
import { ChatPrimitives } from "./ai-conversation";
import { AutoScroll } from "./auto-scroll";
import { getRecentUserPrompts } from "./chat-input-history";
import type { ChatInputQuestionPrompt, ChatInputQuestionResponse } from "./chat-input-question-prompt";
import { ChatMessageList } from "./chat-message-list";
import { ChatPanelComposer, useQueuedFollowUpComposer } from "./chat-panel-composer";
import {
  groupMessagesByTurn,
  normalizeChatMessagesForDisplay,
  type QueuedFollowUp,
  type SessionMessage,
} from "./message-types";
import type { QueuedFollowUpMoveDirection } from "./queued-follow-up-list-state";
import { WorkingIndicator } from "./working-indicator";

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
  onSubmitMessage?: (
    text: string,
    attachments: string[],
    questionResponse?: ChatInputQuestionResponse,
  ) => void | Promise<void>;
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
  /** Blocks sending while the editor stays usable, for example while no model is selected. */
  submitDisabled?: boolean;
  chatInputQuestionPrompt?: ChatInputQuestionPrompt;
  chatInputAutoFocus?: boolean;
  queuedFollowUps?: QueuedFollowUp[];
  onQueuedFollowUpUpdate?: (itemId: string, prompt: string) => void;
  onQueuedFollowUpRemove?: (itemId: string) => void;
  onQueuedFollowUpMove?: (itemId: string, direction: QueuedFollowUpMoveDirection, steps?: number) => void;
  chatInputReferences?: ReferenceItem[];
  onChatInputAddReference?: (resourceId: string, resourceType: ReferenceItem["resourceType"]) => void;
}

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
    submitDisabled = false,
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
        conversationKey={conversationKey ?? messages[0]?.id}
        recentUserMessages={getRecentUserPrompts(messages)}
        actions={actions}
        attachedResources={attachedResources}
        attachmentList={attachmentList}
        chatInputAutoFocus={chatInputAutoFocus}
        chatInputPlaceholder={chatInputPlaceholder}
        chatInputQuestionPrompt={activeQuestionPrompt}
        chatInputReferences={chatInputReferences}
        hasWorkspaceHub={hasWorkspaceHub}
        inputDisabled={inputDisabled}
        submitDisabled={submitDisabled}
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
