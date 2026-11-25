import { Box } from "@chakra-ui/react";
import { ActivityAvatar } from "@/components/activity/activity-avatar";
import { Tooltip } from "@/components/primitives/tooltip";
import type { SessionMessageSender } from "./message-types";

export const MessageSender = (props: { sender?: SessionMessageSender }) => {
  const { sender } = props;
  if (!sender) return null;
  return (
    <Tooltip content={sender.name}>
      <Box role="img" aria-label={`Message from ${sender.name}`} tabIndex={0} display="inline-flex" flexShrink="0">
        <ActivityAvatar actor={{ name: sender.name }} />
      </Box>
    </Tooltip>
  );
};
