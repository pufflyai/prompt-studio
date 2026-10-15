import { Button, Flex, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ChatMessage } from "./ai-message";
import { messageFadeInProps } from "./chat-message-animation";
import { MessageActionPanel } from "./message-action-panel";
import { MessagePartsRenderer } from "./message-parts-renderer";
import { getMessageOrigin, type SessionMessage } from "./message-types";

interface ChatMessageListResponseProps {
  message: SessionMessage;
  streaming: boolean;
  hideQuestionForms?: boolean;
  animate?: boolean;
  showAssistantActions: boolean;
}

export const ChatMessageListResponse = (props: ChatMessageListResponseProps) => {
  const { message, streaming, hideQuestionForms = false, animate = false, showAssistantActions } = props;
  const from = getMessageOrigin(message.role);
  const showActions = from === "user" || (from === "assistant" && showAssistantActions);

  return (
    <ChatMessage.Root from={from} {...(animate ? messageFadeInProps : undefined)}>
      <ChatMessage.Content from={from}>
        <MessagePartsRenderer
          message={message}
          streaming={streaming && from === "assistant"}
          hideQuestionForms={hideQuestionForms}
        />
        {showActions ? (
          <MessageActionPanel message={message} alwaysVisible={from === "user"} copyAlwaysVisible={from !== "user"} />
        ) : null}
      </ChatMessage.Content>
    </ChatMessage.Root>
  );
};

interface StickyMessageToggleProps {
  expanded: boolean;
  label: string;
  onClick: () => void;
  actionPanel?: ReactNode;
}

export const StickyMessageToggle = (props: StickyMessageToggleProps) => {
  const { expanded, label, onClick, actionPanel } = props;
  const recipe = useSlotRecipe({ key: "stickyUserMessage" });
  const styles = recipe({ expanded });

  return (
    <Flex css={styles.footer}>
      {actionPanel}
      <Button size="2xs" variant="outline" pointerEvents="auto" onClick={onClick}>
        {label}
      </Button>
    </Flex>
  );
};
