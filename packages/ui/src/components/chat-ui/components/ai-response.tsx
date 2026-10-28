import type { BoxProps } from "@chakra-ui/react";
import { Box } from "@chakra-ui/react";
import { RichMessage } from "@/components/rich-text";
import type { ChatLinkProps } from "../links/chat-link";

export interface ChatRichContentProps extends Omit<BoxProps, "children">, ChatLinkProps {
  children: string;
  streaming?: boolean;
}

const ChatRichContent = (props: ChatRichContentProps) => {
  const { children, linkHandler, streaming, ...rest } = props;

  return (
    <Box data-chat-response {...rest}>
      <RichMessage defaultState={children} linkHandler={linkHandler} streaming={streaming} fullWidth />
    </Box>
  );
};

export const Response = ChatRichContent;
