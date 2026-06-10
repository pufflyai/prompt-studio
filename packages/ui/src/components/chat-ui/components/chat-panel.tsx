import { Flex, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { MessageCircleIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatPrimitives } from "./ai-conversation";
import { AutoScroll } from "./auto-scroll";
import { ChatInput } from "./chat-input";
import type { ChatInputQuestionPrompt, ChatInputQuestionResponse } from "./chat-input-question-prompt";
import { ChatMessageList } from "./chat-message-list";
import { groupMessagesByTurn, mergeReasoningToolOnlyMessages, type SessionMessage } from "./message-types";

/** Full conversation shell for agent sessions, including messages, input, attachments, and host-provided slots. */
interface ChatPanelProps {
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
  onChatInputChange?: (text: string) => void;
  /** Extra controls rendered near the chat input. */
  actions?: ReactNode;
  repoMenu?: ReactNode;
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
    onChatInputChange,
    actions,
    repoMenu,
    attachedResources,
    onClearAttachments,
    attachmentList,
    approvalPrompt,
    workspaceHub,
    workspaceInitializing = false,
    inputDisabled = false,
    chatInputQuestionPrompt,
    chatInputAutoFocus = false,
  } = props;

  const merged = mergeReasoningToolOnlyMessages(messages);
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
  const hideActiveQuestionForms = Boolean(chatInputQuestionPrompt);
  const showThinkingIndicator = streaming && hasMessages && !workspaceInitializing;
  const isMessageViewportReady = !messageListIdentity || readyMessageListKey === messageListIdentity;

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
        <AutoScroll userMessageCount={userMessageCount} />
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
      {showThinkingIndicator ? (
        <HStack gap="xs" px="sm" py="2xs">
          <Spinner size="xs" color="fg.muted" />
          <Text textStyle="label/XS/regular" color="fg.muted">
            Working...
          </Text>
        </HStack>
      ) : null}
      <Stack px="xs" gap={hasWorkspaceHub ? "0" : "xs"}>
        {workspaceHub}
        <ChatInput
          placeholder={chatInputPlaceholder}
          defaultState={createSerializedPromptState(chatInputDefaultValue)}
          streaming={streaming}
          onSubmit={onSubmitMessage}
          onInterrupt={onInterrupt}
          onChange={onChatInputChange}
          actions={actions}
          attachedResources={attachedResources}
          onClearAttachments={onClearAttachments}
          attachmentList={attachmentList}
          isDisabled={inputDisabled}
          attachedToTop={hasWorkspaceHub}
          questionPrompt={chatInputQuestionPrompt}
          autoFocus={chatInputAutoFocus}
        />
      </Stack>
      <Flex p="2xs" justifyContent="flex-end">
        {repoMenu}
      </Flex>
    </Flex>
  );
};
