import { Box, chakra, useRecipe } from "@chakra-ui/react";
import { ActivityAvatar } from "@/components/activity/activity-avatar";
import { Tooltip } from "@/components/primitives/tooltip";
import { chatMessageSenderRecipe } from "@/theme/recipes/chat-message-sender";
import { useChatLinkHandler } from "../links/chat-link-context";
import type { SessionMessageSender } from "./message-types";

export const MessageSender = (props: { sender?: SessionMessageSender }) => {
  const { sender } = props;
  const handler = useChatLinkHandler();
  const openSession = sender?.type === "session" ? handler?.openSession : undefined;
  const styles = useRecipe({ recipe: chatMessageSenderRecipe })({ interactive: Boolean(openSession) });
  if (!sender) return null;
  const avatar = <ActivityAvatar actor={{ name: sender.name }} />;
  return (
    <Tooltip content={sender.name}>
      {openSession ? (
        <chakra.button
          type="button"
          aria-label={`Open session ${sender.name}`}
          css={styles}
          onClick={() => void openSession(sender.id)}
        >
          {avatar}
        </chakra.button>
      ) : (
        <Box role="img" aria-label={`Message from ${sender.name}`} tabIndex={0} css={styles}>
          {avatar}
        </Box>
      )}
    </Tooltip>
  );
};
