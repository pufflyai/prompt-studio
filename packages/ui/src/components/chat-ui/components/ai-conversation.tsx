import type { HTMLChakraProps, IconButtonProps } from "@chakra-ui/react";
import { AbsoluteCenter, chakra, IconButton } from "@chakra-ui/react";
import { ArrowDownIcon } from "lucide-react";
import { StickToBottom as StickToBottomEl, useStickToBottomContext } from "use-stick-to-bottom";
import { ScrollArea } from "@/components/primitives/scroll-area";

export type ConversationRootProps = HTMLChakraProps<"div", React.ComponentProps<typeof StickToBottomEl>>;

export const conversationRootDefaultProps = {
  "aria-roledescription": "conversation",
  initial: "instant",
  resize: "instant",
  role: "log",
} as const;

export const ConversationRoot = chakra(
  StickToBottomEl,
  {
    base: {
      position: "relative",
      flex: 1,
      overflow: "hidden",
      height: "full",
    },
  },
  {
    forwardProps: ["initial", "resize"],
    defaultProps: conversationRootDefaultProps,
  },
);

export type ConversationContentProps = Omit<React.ComponentProps<typeof ScrollArea>, "contentProps" | "viewportRef">;

export const ConversationContent = (props: ConversationContentProps) => {
  const { children, ...rest } = props;
  const { contentRef, scrollRef } = useStickToBottomContext();

  return (
    <ScrollArea
      {...rest}
      height="full"
      width="full"
      showHorizontalScrollbar={false}
      viewportRef={scrollRef as React.Ref<HTMLDivElement>}
      contentRef={contentRef as React.Ref<HTMLDivElement>}
      verticalScrollbarProps={{ zIndex: 2 }}
      contentProps={{
        py: "sm",
        "aria-live": "polite",
        role: "list",
      }}
    >
      {children}
    </ScrollArea>
  );
};

export type ConversationScrollButtonProps = IconButtonProps;

export const conversationScrollButtonContainerDefaultProps = {
  axis: "horizontal",
  bottom: "md",
  zIndex: 2,
} as const;

export const ConversationScrollButton = (props: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <AbsoluteCenter {...conversationScrollButtonContainerDefaultProps}>
        <IconButton rounded="full" onClick={() => scrollToBottom()} variant="outline" size="xs" {...props}>
          <ArrowDownIcon size={16} />
        </IconButton>
      </AbsoluteCenter>
    )
  );
};

export const ChatPrimitives = {
  Root: ConversationRoot,
  Viewport: ConversationContent,
  ScrollToBottom: ConversationScrollButton,
} as const;
