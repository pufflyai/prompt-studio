import { Flex } from "@chakra-ui/react";
import { MessageCircleIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/primitives/empty-state";
import type { PromptCommand } from "@/components/rich-text";
import { ChatImageHistoryContext, indexChatImageSources } from "../links/chat-image-sources";
import type { ChatLinkProps } from "../links/chat-link";
import { ChatLinkProvider } from "../links/chat-link-context";
import { resolveActiveQuestionPrompt } from "../tool-rendering/question-prompt";
import { ChatPrimitives } from "./ai-conversation";
import { AutoScroll } from "./auto-scroll";
import { getRecentUserPrompts } from "./chat-input-history";
import type { ChatInputQuestionPrompt, ChatInputQuestionResponse } from "./chat-input-question-prompt";
import { ChatMessageList } from "./chat-message-list";
import { ChatPanelComposer, useQueuedFollowUpComposer } from "./chat-panel-composer";
import { ChatQuestionNavigationContext, useChatQuestionNavigation } from "./chat-question-navigation";
import type { ComposerDecision } from "./composer-decision";
import {
  groupMessagesByTurn,
  normalizeChatMessagesForDisplay,
  type QueuedFollowUp,
  type SessionMessage,
} from "./message-types";
import type { QueuedFollowUpMoveDirection } from "./queued-follow-up-list-state";
import { WorkingIndicator } from "./working-indicator";

/** Full conversation shell for agent sessions, including messages, input, attachments, and host-provided slots. */
export interface ChatPanelProps extends ChatLinkProps {
  /** Stable conversation identity used to reset ready state when switching sessions. */
  conversationKey?: string;
  messages: SessionMessage[];
  loading?: boolean;
  streaming?: boolean;
  /** Current run start in milliseconds. Without an anchor, elapsed time starts when streaming mounts. */
  streamingStartedAt?: number;
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
  /** Controls shared by the message and question toolbars (model, params). */
  actions?: ReactNode;
  /** Attachment controls shown only while editing a message draft. */
  attachmentActions?: ReactNode;
  composerHeader?: ReactNode;
  attachedResources?: string[];
  onClearAttachments?: () => void;
  attachmentList?: ReactNode;
  approvalPrompt?: ReactNode;
  /** Problems shown at the end of the conversation, such as a failed load or a message that was not sent. Without messages, they appear above the empty state. */
  conversationNotices?: ReactNode;
  /** Optional workspace status/control surface rendered above the conversation viewport. */
  workspaceHub?: ReactNode;
  workspaceInitializing?: boolean;
  inputDisabled?: boolean;
  /** Blocks sending while the editor stays usable, for example while no model is selected. */
  submitDisabled?: boolean;
  chatInputQuestionPrompt?: ChatInputQuestionPrompt;
  composerDecision?: ComposerDecision;
  chatInputAutoFocus?: boolean;
  queuedFollowUps?: QueuedFollowUp[];
  onQueuedFollowUpUpdate?: (itemId: string, prompt: string) => void | Promise<void>;
  /** Submit the retained edit's settings and files as a new request. */
  onQueuedFollowUpCreate?: (itemId: string, prompt: string) => void | Promise<void>;
  /** Move the retained edit's settings and files into the normal draft before its text changes. */
  onQueuedFollowUpRestoreDraft?: (itemId: string) => void;
  /** Allow recovery only when the normal draft has no files or uploads and the host can transfer the edit. */
  canRestoreQueuedEditToDraft?: boolean;
  onQueuedFollowUpSelect?: (item: QueuedFollowUp | null) => void;
  onQueuedFollowUpDiscard?: (itemId: string) => void;
  onQueuedFollowUpSteer?: (item: QueuedFollowUp) => void | Promise<void>;
  onQueuedFollowUpCombine?: (source: QueuedFollowUp, target: QueuedFollowUp) => void | Promise<void>;
  queueSteeringUnavailableReason?: string | null;
  unsavedQueueItemIds?: string[];

  onQueuedFollowUpRemove?: (itemId: string) => void;
  onQueuedFollowUpMove?: (
    itemId: string,
    direction: QueuedFollowUpMoveDirection,
    steps?: number,
    selection?: { source: QueuedFollowUp; items: QueuedFollowUp[] },
  ) => void;
  chatInputCommands?: PromptCommand[];
}

export const ChatPanel = (props: ChatPanelProps) => {
  const {
    conversationKey,
    linkHandler,
    messages,
    loading = false,
    streaming = false,
    streamingStartedAt,
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
    attachmentActions,
    composerHeader,
    attachedResources,
    onClearAttachments,
    attachmentList,
    approvalPrompt,
    conversationNotices,
    workspaceHub,
    workspaceInitializing = false,
    inputDisabled = false,
    submitDisabled = false,
    chatInputQuestionPrompt,
    composerDecision,
    chatInputAutoFocus = false,
    queuedFollowUps = [],
    onQueuedFollowUpUpdate,
    onQueuedFollowUpCreate,
    onQueuedFollowUpRestoreDraft,
    canRestoreQueuedEditToDraft,
    onQueuedFollowUpSelect,
    onQueuedFollowUpDiscard,
    onQueuedFollowUpSteer,
    onQueuedFollowUpCombine,
    queueSteeringUnavailableReason,
    unsavedQueueItemIds,
    onQueuedFollowUpRemove,
    onQueuedFollowUpMove,
    chatInputCommands = [],
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
  const questionNavigation = useChatQuestionNavigation(messages, conversationKey ?? messages[0]?.id);
  const activeQuestionPrompt =
    questionNavigation.prompt ?? chatInputQuestionPrompt ?? resolveActiveQuestionPrompt(messages);
  const hideActiveQuestionForms = Boolean(activeQuestionPrompt);
  const showThinkingIndicator = streaming && hasMessages && !workspaceInitializing && !activeQuestionPrompt;
  const isMessageViewportReady = !messageListIdentity || readyMessageListKey === messageListIdentity;
  const queuedComposer = useQueuedFollowUpComposer({
    queuedFollowUps,
    defaultValue: chatInputDefaultValue,
    onChange: onChatInputChange,
    onSubmit: onSubmitMessage,
    onUpdate: onQueuedFollowUpUpdate,
    onCreate: onQueuedFollowUpCreate,
    onRestoreDraft: onQueuedFollowUpRestoreDraft,
    canRestoreDraft: canRestoreQueuedEditToDraft,
    disabled: inputDisabled,
    onSelect: onQueuedFollowUpSelect,
    onDiscard: onQueuedFollowUpDiscard,
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
    <ChatImageHistoryContext value={indexChatImageSources(messages, linkHandler)}>
      <ChatLinkProvider handler={linkHandler}>
        <ChatQuestionNavigationContext value={questionNavigation.value}>
          <Flex position="relative" direction="column" w="full" h="full" overflow="hidden">
            <ChatPrimitives.Root>
              <AutoScroll conversationKey={messageListKey ?? null} userMessageCount={userMessageCount} />
              <ChatPrimitives.Viewport visibility={isMessageViewportReady ? "visible" : "hidden"}>
                {hasMessages ? (
                  <>
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
                    {conversationNotices}
                  </>
                ) : (
                  <>
                    {conversationNotices}
                    {emptyContent}
                  </>
                )}
              </ChatPrimitives.Viewport>
              {isMessageViewportReady ? <ChatPrimitives.ScrollToBottom aria-label="Scroll to latest message" /> : null}
            </ChatPrimitives.Root>
            {approvalPrompt}
            {streaming ? (
              <WorkingIndicator key={messageListKey} startedAt={streamingStartedAt} hidden={!showThinkingIndicator} />
            ) : null}
            <ChatPanelComposer
              conversationKey={conversationKey ?? messages[0]?.id}
              recentUserMessages={getRecentUserPrompts(messages)}
              actions={actions}
              attachmentActions={attachmentActions}
              composerHeader={composerHeader}
              attachedResources={attachedResources}
              attachmentList={attachmentList}
              chatInputAutoFocus={chatInputAutoFocus}
              chatInputPlaceholder={chatInputPlaceholder}
              chatInputQuestionPrompt={activeQuestionPrompt}
              composerDecision={questionNavigation.prompt ? undefined : composerDecision}
              chatInputCommands={chatInputCommands}
              hasWorkspaceHub={hasWorkspaceHub}
              inputDisabled={inputDisabled}
              submitDisabled={submitDisabled}
              onAttachFiles={onAttachFiles}
              onAttachText={onAttachText}
              onClearAttachments={onClearAttachments}
              onInterrupt={onInterrupt}
              onQueuedFollowUpMove={onQueuedFollowUpMove}
              onQueuedFollowUpRemove={onQueuedFollowUpRemove}
              onQueuedFollowUpUpdate={onQueuedFollowUpUpdate}
              onQueuedFollowUpSteer={onQueuedFollowUpSteer}
              onQueuedFollowUpCombine={onQueuedFollowUpCombine}
              queueSteeringUnavailableReason={queueSteeringUnavailableReason}
              unsavedQueueItemIds={unsavedQueueItemIds}
              queuedComposer={queuedComposer}
              queuedFollowUps={queuedFollowUps}
              streaming={streaming}
              workspaceHub={workspaceHub}
            />
          </Flex>
        </ChatQuestionNavigationContext>
      </ChatLinkProvider>
    </ChatImageHistoryContext>
  );
};
