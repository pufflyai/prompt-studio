import { HStack, IconButton, Text } from "@chakra-ui/react";
import { GitFork } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";

interface MessageForkActionProps {
  messageId: string;
  onForkMessage: (messageId: string) => void | Promise<void>;
  disabledReason?: string;
}

export const MessageForkAction = (props: MessageForkActionProps) => {
  const { messageId, onForkMessage, disabledReason } = props;
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string>();
  const fork = async () => {
    if (disabledReason || forking) return;
    setForking(true);
    setError(undefined);
    try {
      await onForkMessage(messageId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not fork this conversation.");
    } finally {
      setForking(false);
    }
  };
  return (
    <HStack gap="2xs">
      <Tooltip content={disabledReason ?? "Fork conversation"}>
        <IconButton
          aria-label="Fork conversation"
          aria-disabled={Boolean(disabledReason) || forking}
          title={disabledReason}
          variant="ghost"
          size="2xs"
          loading={forking}
          onClick={fork}
        >
          <GitFork size={12} />
        </IconButton>
      </Tooltip>
      {error ? (
        <Text role="alert" color="fg.error" textStyle="label/XS/regular">
          {error}
        </Text>
      ) : null}
    </HStack>
  );
};
