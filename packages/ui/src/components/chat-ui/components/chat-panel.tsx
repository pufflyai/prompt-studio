import { Box, Button, Flex, Stack } from "@chakra-ui/react";
import { MessageCircleIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatPrimitives } from "./ai-conversation";
import { ChatMessage } from "./ai-message";
import { AutoScroll } from "./auto-scroll";
import { ChatInput } from "./chat-input";
import {
  isStickyUserMessageCollapsible,
  STICKY_USER_MESSAGE_COLLAPSED_MAX_HEIGHT,
} from "./chat-panel-sticky-user-message";
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
  chatInputPlaceholder: string;
  chatInputDefaultValue?: string;
  onSubmitMessage?: (text: string, attachments: string[]) => void;
  onChatInputChange?: (text: string) => void;
  actions?: ReactNode;
  repoMenu?: ReactNode;
  attachedResources?: string[];
  onClearAttachments?: () => void;
  attachmentList?: ReactNode;
  approvalPrompt?: ReactNode;
}

const renderMessage = (message: SessionMessage, streaming: boolean) => {
  const from = getMessageOrigin(message.role);
  return (
    <ChatMessage.Root key={message.id} from={from}>
      <ChatMessage.Content from={from}>
        <MessagePartsRenderer message={message} streaming={streaming} />
      </ChatMessage.Content>
    </ChatMessage.Root>
  );
};

export const ChatPanel = (props: ChatPanelProps) => {
  const {
    messages,
    streaming = false,
    emptyStateTitle,
    emptyStateDescription,
    chatInputPlaceholder,
    chatInputDefaultValue = "",
    onSubmitMessage,
    onChatInputChange,
    actions,
    repoMenu,
    attachedResources,
    onClearAttachments,
    attachmentList,
    approvalPrompt,
  } = props;

  const merged = mergeReasoningToolOnlyMessages(messages);
  const hasMessages = merged.length > 0;
  const userMessageCount = merged.reduce((count, message) => count + (message.role === "user" ? 1 : 0), 0);
  const { groups, leadingResponses } = groupMessagesByTurn(merged);
  const [expandedStickyMessageIds, setExpandedStickyMessageIds] = useState(() => new Set<string>());

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
              {leadingResponses.map((message) => renderMessage(message, streaming))}
              {groups.map((group) => {
                const isCollapsible = isStickyUserMessageCollapsible(group.userMessage);
                const isExpanded = expandedStickyMessageIds.has(group.userMessage.id);

                return (
                  <Box key={group.userMessage.id}>
                    <Box position="sticky" top="0" zIndex={1}>
                      <Box position="relative">
                        <ChatMessage.Root from="user">
                          <ChatMessage.Content
                            from="user"
                            maxH={isCollapsible && !isExpanded ? STICKY_USER_MESSAGE_COLLAPSED_MAX_HEIGHT : undefined}
                            overflowY="hidden"
                          >
                            <MessagePartsRenderer message={group.userMessage} streaming={streaming} />
                          </ChatMessage.Content>
                        </ChatMessage.Root>
                        {isCollapsible && !isExpanded && (
                          <Flex
                            position="absolute"
                            bottom="0"
                            left="0"
                            right="0"
                            justifyContent="flex-end"
                            alignItems="flex-end"
                            px="xs"
                            pb="xs"
                            pt="lg"
                            bgGradient="to-t"
                            gradientFrom="bg.subtle"
                            gradientTo="transparent"
                            borderBottomRadius="xs"
                          >
                            <Button
                              size="2xs"
                              variant="solid"
                              onClick={() => toggleStickyMessageExpanded(group.userMessage.id)}
                            >
                              Show more
                            </Button>
                          </Flex>
                        )}
                      </Box>
                      {isCollapsible && isExpanded && (
                        <Flex justifyContent="flex-end" mt="2xs" mb="sm">
                          <Button
                            size="2xs"
                            variant="ghost"
                            onClick={() => toggleStickyMessageExpanded(group.userMessage.id)}
                          >
                            Show less
                          </Button>
                        </Flex>
                      )}
                    </Box>
                    {group.responses.map((message) => renderMessage(message, streaming))}
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <EmptyState
              icon={<MessageCircleIcon size={48} strokeWidth={1.5} />}
              title={emptyStateTitle}
              description={emptyStateDescription}
            />
          )}
        </ChatPrimitives.Viewport>
        <ChatPrimitives.ScrollToBottom aria-label="Scroll to latest message" />
      </ChatPrimitives.Root>
      {approvalPrompt}
      <Box px="sm">
        <ChatInput
          placeholder={chatInputPlaceholder}
          defaultState={createSerializedPromptState(chatInputDefaultValue)}
          streaming={streaming}
          onSubmit={onSubmitMessage}
          onChange={onChatInputChange}
          actions={actions}
          attachedResources={attachedResources}
          onClearAttachments={onClearAttachments}
          attachmentList={attachmentList}
        />
      </Box>
      <Flex p="2xs" justifyContent="flex-end">
        {repoMenu}
      </Flex>
    </Flex>
  );
};
