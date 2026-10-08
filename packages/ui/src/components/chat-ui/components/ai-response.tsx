import type { BoxProps } from "@chakra-ui/react";
import { Box } from "@chakra-ui/react";
import { RichMessage } from "@/components/rich-text";
import type { ChatLinkProps } from "../links/chat-link";

export interface ChatRichContentProps extends Omit<BoxProps, "children">, ChatLinkProps {
  children: string;
}

const ChatRichContent = (props: ChatRichContentProps) => {
  const { children, linkHandler, ...rest } = props;

  return (
    <Box {...rest}>
      <RichMessage defaultState={children} linkHandler={linkHandler} fullWidth />
    </Box>
  );
};

export const Response = ChatRichContent;
