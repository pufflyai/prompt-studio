import { Button, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import type { ChatInputAction } from "./chat-input-actions";
import { COMPOSER_CONTROL_HEIGHT } from "./composer-constants";
import { SendButton } from "./send-button";

interface ChatInputToolbarProps {
  actions?: ReactNode;
  questionPrompt: boolean;
  skipDisabled: boolean;
  skipTitle: string;
  onSkip: () => void;
  buttonAction: ChatInputAction;
  submitTitle?: string;
  messageTitle: string;
  runAction: (action: ChatInputAction) => void;
}
export const ChatInputToolbar = (props: ChatInputToolbarProps) => {
  const {
    actions,
    questionPrompt,
    skipDisabled,
    skipTitle,
    onSkip,
    buttonAction,
    submitTitle,
    messageTitle,
    runAction,
  } = props;
  return (
    <HStack gap="1" minH={COMPOSER_CONTROL_HEIGHT} align="center">
      <ScrollArea flex="1" minW="0" showVerticalScrollbar={false} showHorizontalScrollbar>
        <HStack gap="1" width="max-content" minH={COMPOSER_CONTROL_HEIGHT}>
          {actions}
        </HStack>
      </ScrollArea>
      {questionPrompt ? (
        <Button size="xs" variant="ghost" disabled={skipDisabled} title={skipTitle} onClick={onSkip}>
          Skip
        </Button>
      ) : null}
      <SendButton
        canInterrupt={buttonAction === "interrupt"}
        title={buttonAction === "interrupt" ? "Stop Response" : (submitTitle ?? messageTitle)}
        shortcut={buttonAction === "submit" ? "Enter" : undefined}
        onClick={() => runAction(buttonAction)}
        disabled={buttonAction === "none"}
      />
    </HStack>
  );
};
