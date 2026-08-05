import { Box, Button, Flex } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useEffect, useRef, type WheelEvent } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { ChatMessage } from "./ai-message";
import { messageFadeInProps, useMessageAnimationKeys } from "./chat-message-animation";
import {
  isStickyUserMessageCollapsible,
  STICKY_USER_MESSAGE_COLLAPSED_MAX_HEIGHT,
  STICKY_USER_MESSAGE_EXPANDED_MAX_HEIGHT,
  shouldStopStickyUserMessageWheel,
} from "./chat-panel-sticky-user-message";
import { MessageActionPanel } from "./message-action-panel";
import { MessagePartsRenderer } from "./message-parts-renderer";
import { getMessageOrigin, type MessageGroup, type SessionMessage } from "./message-types";

interface ChatMessageListProps {
  leadingResponses: SessionMessage[];
  groups: MessageGroup[];
  streaming: boolean;
  hideActiveQuestionForms: boolean;
  expandedStickyMessageIds: Set<string>;
  onToggleStickyMessage: (messageId: string) => void;
  onReady?: () => void;
}

interface StickyMessageToggleProps {
  label: string;
  onClick: () => void;
  actionPanel?: ReactNode;
}

interface StickyMessageGroupProps {
  group: MessageGroup;
  streaming: boolean;
  hideQuestionForms: boolean;
  isExpanded: boolean;
  animate: boolean;
  onToggleStickyMessage: (messageId: string) => void;
}

type ChatMessageListItem =
  | {
      type: "leading-response";
      key: string;
      message: SessionMessage;
    }
  | {
      type: "group";
      key: string;
      group: MessageGroup;
      groupIndex: number;
    };

const ESTIMATED_TURN_HEIGHT = 720;
const INITIAL_TAIL_VIEWPORT_HEIGHT = 1;
const TAIL_READY_STABLE_FRAME_COUNT = 3;
const TAIL_READY_FRAME_LIMIT = 20;
const TAIL_READY_PIXEL_EPSILON = 1;
const VIRTUAL_LIST_OVERSCAN = 4;
const VIRTUAL_LIST_GAP = 8;

const buildMessageListItems = (leadingResponses: SessionMessage[], groups: MessageGroup[]) => [
  ...leadingResponses.map((message) => ({
    type: "leading-response" as const,
    key: message.id,
    message,
  })),
  ...groups.map((group, groupIndex) => ({
    type: "group" as const,
    key: group.userMessage.id,
    group,
    groupIndex,
  })),
];

const getEstimatedTailOffset = (count: number, viewportHeight: number) => {
  if (count === 0) return 0;

  const estimatedTotalSize = count * ESTIMATED_TURN_HEIGHT + (count - 1) * VIRTUAL_LIST_GAP;
  return Math.max(estimatedTotalSize - viewportHeight, 0);
};

const getInitialViewportHeight = (scrollElement: HTMLElement | null) =>
  scrollElement?.clientHeight || INITIAL_TAIL_VIEWPORT_HEIGHT;

interface TailLayoutSnapshot {
  scrollTop: number;
  totalSize: number;
}

const isTailLayoutStable = (current: TailLayoutSnapshot, previous: TailLayoutSnapshot) =>
  Math.abs(current.scrollTop - previous.scrollTop) <= TAIL_READY_PIXEL_EPSILON &&
  Math.abs(current.totalSize - previous.totalSize) <= TAIL_READY_PIXEL_EPSILON;

const readTailLayoutSnapshot = (scrollElement: HTMLElement | null, totalSize: number): TailLayoutSnapshot => ({
  scrollTop: scrollElement?.scrollTop ?? 0,
  totalSize,
});

const useTailReady = (input: {
  itemCount: number;
  onReady?: () => void;
  scrollRef: { current: HTMLElement | null };
  totalSize: number;
}) => {
  const { itemCount, onReady, scrollRef, totalSize } = input;
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (itemCount === 0 || typeof requestAnimationFrame === "undefined") {
      onReadyRef.current?.();
      return;
    }

    let frameId = 0;
    let checkedFrameCount = 0;
    let stableFrameCount = 0;
    let previousSnapshot: TailLayoutSnapshot | null = null;

    const waitForStableTail = () => {
      checkedFrameCount += 1;

      const nextSnapshot = readTailLayoutSnapshot(scrollRef.current, totalSize);
      stableFrameCount =
        previousSnapshot && isTailLayoutStable(nextSnapshot, previousSnapshot) ? stableFrameCount + 1 : 0;
      previousSnapshot = nextSnapshot;

      if (stableFrameCount >= TAIL_READY_STABLE_FRAME_COUNT || checkedFrameCount >= TAIL_READY_FRAME_LIMIT) {
        onReadyRef.current?.();
        return;
      }

      frameId = requestAnimationFrame(waitForStableTail);
    };

    frameId = requestAnimationFrame(waitForStableTail);

    return () => cancelAnimationFrame(frameId);
  }, [itemCount, scrollRef, totalSize]);
};

const StickyMessageToggle = (props: StickyMessageToggleProps) => {
  const { label, onClick, actionPanel } = props;

  return (
    <Flex
      position="absolute"
      bottom="0"
      left="0"
      right="0"
      justifyContent={actionPanel ? "space-between" : "flex-end"}
      alignItems="flex-end"
      px="xs"
      pb="xs"
      pt="lg"
      bgGradient="to-t"
      gradientFrom="bg.subtle"
      gradientTo="transparent"
      borderBottomRadius="xs"
      pointerEvents="none"
    >
      {actionPanel}
      <Button size="2xs" variant="outline" pointerEvents="auto" onClick={onClick}>
        {label}
      </Button>
    </Flex>
  );
};

const renderMessage = (message: SessionMessage, streaming: boolean, hideQuestionForms = false, animate = false) => {
  const from = getMessageOrigin(message.role);

  return (
    <ChatMessage.Root from={from} {...(animate ? messageFadeInProps : undefined)}>
      <ChatMessage.Content from={from}>
        <MessagePartsRenderer message={message} streaming={streaming} hideQuestionForms={hideQuestionForms} />
        {from === "assistant" || from === "user" ? (
          <MessageActionPanel message={message} alwaysVisible={from === "user"} copyAlwaysVisible={from !== "user"} />
        ) : null}
      </ChatMessage.Content>
    </ChatMessage.Root>
  );
};

const handleExpandedStickyMessageWheel = (event: WheelEvent<HTMLElement>) => {
  if (shouldStopStickyUserMessageWheel(event.currentTarget, event.deltaY)) {
    event.stopPropagation();
  }
};

const getStickyMessageMaxHeight = (isCollapsible: boolean, isExpanded: boolean) => {
  if (!isCollapsible) return undefined;
  if (isExpanded) return STICKY_USER_MESSAGE_EXPANDED_MAX_HEIGHT;

  return STICKY_USER_MESSAGE_COLLAPSED_MAX_HEIGHT;
};

const getStickyMessageBodyMaxHeight = (isExpandedCollapsible: boolean) => {
  if (!isExpandedCollapsible) return undefined;

  return STICKY_USER_MESSAGE_EXPANDED_MAX_HEIGHT;
};

const StickyMessageGroup = (props: StickyMessageGroupProps) => {
  const { group, streaming, hideQuestionForms, isExpanded, animate, onToggleStickyMessage } = props;
  const isCollapsible = isStickyUserMessageCollapsible(group.userMessage);
  const isExpandedCollapsible = isCollapsible && isExpanded;
  const stickyMessageMaxHeight = getStickyMessageMaxHeight(isCollapsible, isExpanded);
  const toggleStickyMessage = () => onToggleStickyMessage(group.userMessage.id);

  return (
    <Box>
      <Box position="sticky" top="0" zIndex={1}>
        <ChatMessage.Root from="user" {...(animate ? messageFadeInProps : undefined)}>
          <ChatMessage.Content
            from="user"
            maxH={stickyMessageMaxHeight}
            overflow="hidden"
            p={isCollapsible ? "0" : undefined}
            position={isCollapsible ? "relative" : undefined}
          >
            <Box
              data-sticky-user-message-content={isCollapsible ? (isExpanded ? "expanded" : "collapsed") : undefined}
              display="flex"
              flexDirection="column"
              gap="sm"
              maxH={getStickyMessageBodyMaxHeight(isExpandedCollapsible)}
              minH="0"
              overflowY={isExpandedCollapsible ? "auto" : "visible"}
              px={isCollapsible ? "xs" : undefined}
              py={isCollapsible ? "xs" : undefined}
              pb={isExpandedCollapsible ? "3rem" : undefined}
              onWheel={isExpandedCollapsible ? handleExpandedStickyMessageWheel : undefined}
            >
              <MessagePartsRenderer message={group.userMessage} streaming={streaming} />
            </Box>
            {isCollapsible ? (
              <StickyMessageToggle
                label={isExpanded ? "Show less" : "Show more"}
                onClick={toggleStickyMessage}
                actionPanel={<MessageActionPanel message={group.userMessage} alwaysVisible copyAlwaysVisible={false} />}
              />
            ) : (
              <MessageActionPanel message={group.userMessage} alwaysVisible copyAlwaysVisible={false} />
            )}
          </ChatMessage.Content>
        </ChatMessage.Root>
      </Box>
      {group.responses.map((message) => (
        <Box key={message.id}>{renderMessage(message, streaming, hideQuestionForms)}</Box>
      ))}
    </Box>
  );
};

const renderListItem = (
  item: ChatMessageListItem,
  props: Pick<
    ChatMessageListProps,
    "groups" | "streaming" | "hideActiveQuestionForms" | "expandedStickyMessageIds" | "onToggleStickyMessage"
  > & { animatedItemKeys: Set<string> },
) => {
  const {
    groups,
    streaming,
    hideActiveQuestionForms,
    expandedStickyMessageIds,
    animatedItemKeys,
    onToggleStickyMessage,
  } = props;

  if (item.type === "leading-response") {
    return renderMessage(
      item.message,
      streaming,
      groups.length > 0 || hideActiveQuestionForms,
      animatedItemKeys.has(item.key),
    );
  }

  return (
    <StickyMessageGroup
      group={item.group}
      streaming={streaming}
      hideQuestionForms={item.groupIndex < groups.length - 1 || hideActiveQuestionForms}
      isExpanded={expandedStickyMessageIds.has(item.group.userMessage.id)}
      animate={animatedItemKeys.has(item.key)}
      onToggleStickyMessage={onToggleStickyMessage}
    />
  );
};

export const ChatMessageList = (props: ChatMessageListProps) => {
  const {
    leadingResponses,
    groups,
    streaming,
    hideActiveQuestionForms,
    expandedStickyMessageIds,
    onToggleStickyMessage,
    onReady,
  } = props;
  const { scrollRef } = useStickToBottomContext();
  const items = buildMessageListItems(leadingResponses, groups);
  const animatedItemKeys = useMessageAnimationKeys(items.map((item) => item.key));
  const initialViewportHeight = getInitialViewportHeight(scrollRef.current);

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: items.length,
    getScrollElement: () => scrollRef.current as HTMLDivElement | null,
    estimateSize: () => ESTIMATED_TURN_HEIGHT,
    getItemKey: (index) => items[index]?.key ?? index,
    overscan: VIRTUAL_LIST_OVERSCAN,
    gap: VIRTUAL_LIST_GAP,
    initialRect: { width: 0, height: initialViewportHeight },
    initialOffset: () => getEstimatedTailOffset(items.length, initialViewportHeight),
  });
  const totalSize = virtualizer.getTotalSize();

  useTailReady({
    itemCount: items.length,
    onReady,
    scrollRef,
    totalSize,
  });

  return (
    <Box px="xs">
      <Box position="relative" width="100%" style={{ height: totalSize }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) return null;

          return (
            <Box
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              data-chat-message-list-item={item.type}
              position="absolute"
              top="0"
              left="0"
              width="100%"
              style={{ top: virtualItem.start }}
            >
              {renderListItem(item, {
                groups,
                streaming,
                hideActiveQuestionForms,
                expandedStickyMessageIds,
                animatedItemKeys,
                onToggleStickyMessage,
              })}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
