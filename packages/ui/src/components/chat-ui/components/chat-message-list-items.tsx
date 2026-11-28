import { Badge, Button, Flex, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ChatMessage } from "./ai-message";
import { useMessageFadeIn } from "./chat-message-animation";
import type { ChatMessagePartRange } from "./chat-message-rows";
import { MessageActionPanel } from "./message-action-panel";
import { MessagePartsRenderer } from "./message-parts-renderer";
import { getMessageOrigin, type SessionMessage } from "./message-types";

interface ChatMessageListResponseProps {
  message: SessionMessage;
  animationKey?: string;
  continues?: boolean;
  partRange?: ChatMessagePartRange;
  occurrences?: number;
  streaming: boolean;
  hideQuestionForms?: boolean;
  animatedKeys: Set<string>;
  showAssistantActions: boolean;
  onForkMessage?: (messageId: string) => void | Promise<void>;
  forkDisabledReason?: string;
}

export const ChatMessageListResponse = (props: ChatMessageListResponseProps) => {
  const {
    message,
    animationKey,
    continues,
    partRange,
    streaming,
    hideQuestionForms = false,
    animatedKeys,
    showAssistantActions,
    onForkMessage,
    forkDisabledReason,
  } = props;
  const fadeInProps = useMessageFadeIn(animationKey ?? message.animationKey ?? message.id, animatedKeys);
  const parts = partRange ? message.parts.slice(partRange.start, partRange.end) : message.parts;
  const displayed = partRange || animationKey !== undefined ? { ...message, animationKey, parts } : message;
  const from = getMessageOrigin(message.role);
  const showActions = from === "user" || (from === "assistant" && showAssistantActions);

  return (
    <ChatMessage.Root from={from} {...fadeInProps}>
      <ChatMessage.Content from={from}>
        <MessagePartsRenderer
          message={displayed}
          streaming={streaming && from === "assistant"}
          hideQuestionForms={hideQuestionForms}
        />
        <MessageOccurrences count={props.occurrences} />
        {!continues && (showActions || message.sender) ? (
          <MessageActionPanel
            message={message}
            showActions={showActions}
            alwaysVisible={from === "user"}
            copyAlwaysVisible={from !== "user"}
            onForkMessage={streaming ? undefined : onForkMessage}
            forkDisabledReason={forkDisabledReason}
          />
        ) : null}
      </ChatMessage.Content>
    </ChatMessage.Root>
  );
};

export const MessageOccurrences = ({ count = 1 }: { count?: number }) =>
  count > 1 ? (
    <Badge size="sm" title={`${count} occurrences`} aria-label={`${count} occurrences`}>
      ×{count}
    </Badge>
  ) : null;

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
