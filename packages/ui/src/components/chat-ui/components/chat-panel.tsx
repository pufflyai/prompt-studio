import { Box, Flex, Stack } from "@chakra-ui/react";
import { MessageCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatPrimitives } from "./ai-conversation";
import { ChatMessage } from "./ai-message";
import { AutoScroll } from "./auto-scroll";
import { ChatInput } from "./chat-input";
import { MessagePartsRenderer } from "./message-parts-renderer";
import { getMessageOrigin, mergeReasoningToolOnlyMessages, type SessionMessage } from "./message-types";

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

  return (
    <Flex position="relative" direction="column" w="full" h="full" overflow="hidden">
      <ChatPrimitives.Root>
        <AutoScroll userMessageCount={userMessageCount} />
        <ChatPrimitives.Viewport>
          {hasMessages ? (
            <Stack gap="sm">
              {merged.map((message) => {
                const from = getMessageOrigin(message.role);

                return (
                  <ChatMessage.Root key={message.id} from={from}>
                    <ChatMessage.Content from={from}>
                      <MessagePartsRenderer message={message} streaming={streaming} />
                    </ChatMessage.Content>
                  </ChatMessage.Root>
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
