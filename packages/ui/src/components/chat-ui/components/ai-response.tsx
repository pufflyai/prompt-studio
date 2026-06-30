import type { BoxProps } from "@chakra-ui/react";
import { Box } from "@chakra-ui/react";
import { RichMessage } from "@/components/rich-text";

export interface ChatRichContentProps extends Omit<BoxProps, "children"> {
  children: string;
}

const ChatRichContent = (props: ChatRichContentProps) => {
  const { children, ...rest } = props;

  return (
    <Box {...rest}>
      <RichMessage defaultState={children} fullWidth />
    </Box>
  );
};

export const Response = ChatRichContent;
