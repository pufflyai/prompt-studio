import { Box, Button, Flex, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { MessageCircleIcon } from "lucide-react";
import { type ReactNode, useState, type WheelEvent } from "react";
import { EmptyState } from "@/components/empty-state";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatPrimitives } from "./ai-conversation";
import { ChatMessage } from "./ai-message";
import { AutoScroll } from "./auto-scroll";
import { ChatInput } from "./chat-input";
import type { ChatInputQuestionPrompt, ChatInputQuestionResponse } from "./chat-input-question-prompt";
import {
  isStickyUserMessageCollapsible,
  STICKY_USER_MESSAGE_COLLAPSED_MAX_HEIGHT,
  STICKY_USER_MESSAGE_EXPANDED_MAX_HEIGHT,
  shouldStopStickyUserMessageWheel,
} from "./chat-panel-sticky-user-message";
import { MessageActionPanel } from "./message-action-panel";
import { MessagePartsRenderer } from "./message-parts-renderer";
import {
  getMessageOrigin,
  groupMessagesByTurn,
  mergeReasoningToolOnlyMessages,
  type SessionMessage,
} from "./message-types";

interface ChatPanelProps {
  messages: SessionMessage[];
  streaming?: boolean;
  emptyStateTitle: string;
  emptyStateDescription: string;
  emptyStateContent?: ReactNode;
  loadingContent?: ReactNode;
  chatInputPlaceholder: string;
  chatInputDefaultValue?: string;
  onSubmitMessage?: (text: string, attachments: string[], questionResponse?: ChatInputQuestionResponse) => void;
  onInterrupt?: () => void;
  onChatInputChange?: (text: string) => void;
  actions?: ReactNode;
  repoMenu?: ReactNode;
  attachedResources?: string[];
  onClearAttachments?: () => void;
  attachmentList?: ReactNode;
  approvalPrompt?: ReactNode;
  workspaceHub?: ReactNode;
  workspaceInitializing?: boolean;
  inputDisabled?: boolean;
  chatInputQuestionPrompt?: ChatInputQuestionPrompt;
  chatInputAutoFocus?: boolean;
}

interface StickyMessageToggleProps {
  label: string;
  onClick: () => void;
  actionPanel?: ReactNode;
}

interface StickyMessageGroupProps {
  group: {
    userMessage: SessionMessage;
    responses: SessionMessage[];
  };
  streaming: boolean;
  hideQuestionForms: boolean;
  isExpanded: boolean;
  onToggleStickyMessage: (messageId: string) => void;
}

const StickyMessageToggle = (props: StickyMessageToggleProps) => {
  const { label, onClick, actionPanel } = props;

  return (
    <Flex
      position="absolute"
      bottom="0"
      left="0"
      right="0"
      justifyContent={actionPanel ? "space-between" : "flex-end"}
      alignItems="flex-end"
      px="xs"
      pb="xs"
      pt="lg"
      bgGradient="to-t"
      gradientFrom="bg.subtle"
      gradientTo="transparent"
      borderBottomRadius="xs"
      pointerEvents="none"
    >
      {actionPanel}
      <Button size="2xs" variant="solid" pointerEvents="auto" onClick={onClick}>
        {label}
      </Button>
    </Flex>
  );
};

const renderMessage = (message: SessionMessage, streaming: boolean, hideQuestionForms = false) => {
  const from = getMessageOrigin(message.role);
  return (
    <ChatMessage.Root key={message.id} from={from}>
      <ChatMessage.Content from={from}>
        <MessagePartsRenderer message={message} streaming={streaming} hideQuestionForms={hideQuestionForms} />
        {from === "assistant" || from === "user" ? (
          <MessageActionPanel message={message} alwaysVisible={from === "user"} />
        ) : null}
      </ChatMessage.Content>
    </ChatMessage.Root>
  );
};

const handleExpandedStickyMessageWheel = (event: WheelEvent<HTMLElement>) => {
  if (shouldStopStickyUserMessageWheel(event.currentTarget, event.deltaY)) {
    event.stopPropagation();
  }
};

const getStickyMessageMaxHeight = (isCollapsible: boolean, isExpanded: boolean) => {
  if (!isCollapsible) return undefined;
  if (isExpanded) return STICKY_USER_MESSAGE_EXPANDED_MAX_HEIGHT;

  return STICKY_USER_MESSAGE_COLLAPSED_MAX_HEIGHT;
};

const getStickyMessageBodyMaxHeight = (isExpandedCollapsible: boolean) => {
  if (!isExpandedCollapsible) return undefined;

  return STICKY_USER_MESSAGE_EXPANDED_MAX_HEIGHT;
};

const StickyMessageGroup = (props: StickyMessageGroupProps) => {
  const { group, streaming, hideQuestionForms, isExpanded, onToggleStickyMessage } = props;
  const isCollapsible = isStickyUserMessageCollapsible(group.userMessage);
  const isExpandedCollapsible = isCollapsible && isExpanded;
  const stickyMessageMaxHeight = getStickyMessageMaxHeight(isCollapsible, isExpanded);
  const toggleStickyMessage = () => onToggleStickyMessage(group.userMessage.id);

  return (
    <Box>
      <Box position="sticky" top="0" zIndex={1}>
        <ChatMessage.Root from="user">
          <ChatMessage.Content
            from="user"
            maxH={stickyMessageMaxHeight}
            overflow="hidden"
            p={isCollapsible ? "0" : undefined}
            position={isCollapsible ? "relative" : undefined}
          >
            <Box
              data-sticky-user-message-content={isCollapsible ? (isExpanded ? "expanded" : "collapsed") : undefined}
              display="flex"
              flexDirection="column"
              gap="sm"
              maxH={getStickyMessageBodyMaxHeight(isExpandedCollapsible)}
              minH="0"
              overflowY={isExpandedCollapsible ? "auto" : "visible"}
              px={isCollapsible ? "xs" : undefined}
              py={isCollapsible ? "xs" : undefined}
              pb={isExpandedCollapsible ? "3rem" : undefined}
              onWheel={isExpandedCollapsible ? handleExpandedStickyMessageWheel : undefined}
            >
              <MessagePartsRenderer message={group.userMessage} streaming={streaming} />
            </Box>
            {isCollapsible ? (
              <StickyMessageToggle
                label={isExpanded ? "Show less" : "Show more"}
                onClick={toggleStickyMessage}
                actionPanel={<MessageActionPanel message={group.userMessage} alwaysVisible />}
              />
            ) : (
              <MessageActionPanel message={group.userMessage} alwaysVisible />
            )}
          </ChatMessage.Content>
        </ChatMessage.Root>
      </Box>
      {group.responses.map((message) => renderMessage(message, streaming, hideQuestionForms))}
    </Box>
  );
};

export const ChatPanel = (props: ChatPanelProps) => {
  const {
    messages,
    streaming = false,
    emptyStateTitle,
    emptyStateDescription,
    emptyStateContent,
    loadingContent,
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
  const userMessageCount = merged.reduce((count, message) => count + (message.role === "user" ? 1 : 0), 0);
  const { groups, leadingResponses } = groupMessagesByTurn(merged);
  const [expandedStickyMessageIds, setExpandedStickyMessageIds] = useState(() => new Set<string>());
  const emptyContent = streaming ? (loadingContent ?? emptyStateContent) : emptyStateContent;
  const hasWorkspaceHub = Boolean(workspaceHub);
  const hideActiveQuestionForms = Boolean(chatInputQuestionPrompt);
  const showThinkingIndicator = streaming && hasMessages && !workspaceInitializing;

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
        <ChatPrimitives.Viewport>
          {hasMessages ? (
            <Stack gap="sm">
              {leadingResponses.map((message) =>
                renderMessage(message, streaming, groups.length > 0 || hideActiveQuestionForms),
              )}
              {groups.map((group, groupIndex) => (
                <StickyMessageGroup
                  key={group.userMessage.id}
                  group={group}
                  streaming={streaming}
                  hideQuestionForms={groupIndex < groups.length - 1 || hideActiveQuestionForms}
                  isExpanded={expandedStickyMessageIds.has(group.userMessage.id)}
                  onToggleStickyMessage={toggleStickyMessageExpanded}
                />
              ))}
            </Stack>
          ) : (
            (emptyContent ?? (
              <EmptyState
                icon={<MessageCircleIcon size={48} strokeWidth={1.5} />}
                title={emptyStateTitle}
                description={emptyStateDescription}
              />
            ))
          )}
        </ChatPrimitives.Viewport>
        <ChatPrimitives.ScrollToBottom aria-label="Scroll to latest message" />
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
      <Stack px="sm" gap={hasWorkspaceHub ? "0" : "xs"}>
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
