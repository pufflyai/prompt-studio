import { Box } from "@chakra-ui/react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { useVirtualizer } from "@/utils/use-virtualizer";
import { useMessageAnimationKeys } from "./chat-message-animation";
import { ChatMessageListResponse, StickyMessageResponse } from "./chat-message-list-items";
import { getAssistantMessageActionTargetId, type MessageGroup, type SessionMessage } from "./message-types";
import { StickyUserMessage } from "./sticky-user-message";
import { useTailReady } from "./use-chat-tail-ready";

interface ChatMessageListProps {
  leadingResponses: SessionMessage[];
  groups: MessageGroup[];
  streaming: boolean;
  hideActiveQuestionForms: boolean;
  expandedStickyMessageIds: Set<string>;
  onToggleStickyMessage: (messageId: string) => void;
  onReady?: () => void;
}

interface StickyMessageGroupProps {
  group: MessageGroup;
  streaming: boolean;
  hideQuestionForms: boolean;
  isExpanded: boolean;
  animate: boolean;
  onToggleStickyMessage: (messageId: string) => void;
}

interface ChatMessageListEntryProps
  extends Pick<
    ChatMessageListProps,
    "streaming" | "hideActiveQuestionForms" | "expandedStickyMessageIds" | "onToggleStickyMessage"
  > {
  item: ChatMessageListItem;
  groupCount: number;
  animate: boolean;
}

type ChatMessageListItem =
  | {
      type: "leading-response";
      key: string;
      message: SessionMessage;
      showAssistantActions: boolean;
    }
  | {
      type: "group";
      key: string;
      group: MessageGroup;
      groupIndex: number;
    };

const ESTIMATED_TURN_HEIGHT = 720;
const INITIAL_TAIL_VIEWPORT_HEIGHT = 1;
const VIRTUAL_LIST_OVERSCAN = 4;
const VIRTUAL_LIST_GAP = 8;

const buildMessageListItems = (leadingResponses: SessionMessage[], groups: MessageGroup[]) => {
  const leadingActionMessageId = getAssistantMessageActionTargetId(leadingResponses);

  return [
    ...leadingResponses.map((message) => ({
      type: "leading-response" as const,
      key: message.id,
      message,
      showAssistantActions: message.id === leadingActionMessageId,
    })),
    ...groups.map((group, groupIndex) => ({
      type: "group" as const,
      key: group.userMessage.id,
      group,
      groupIndex,
    })),
  ];
};

const getEstimatedTailOffset = (count: number, viewportHeight: number) => {
  if (count === 0) return 0;

  const estimatedTotalSize = count * ESTIMATED_TURN_HEIGHT + (count - 1) * VIRTUAL_LIST_GAP;
  return Math.max(estimatedTotalSize - viewportHeight, 0);
};

const getInitialViewportHeight = (scrollElement: HTMLElement | null) =>
  scrollElement?.clientHeight || INITIAL_TAIL_VIEWPORT_HEIGHT;

const StickyMessageGroup = (props: StickyMessageGroupProps) => {
  const { group, streaming, hideQuestionForms, isExpanded, animate, onToggleStickyMessage } = props;
  const actionMessageId = getAssistantMessageActionTargetId(group.responses);

  return (
    <Box>
      <Box position="sticky" top="0" zIndex={1}>
        <StickyUserMessage
          message={group.userMessage}
          expanded={isExpanded}
          animate={animate}
          onToggle={onToggleStickyMessage}
        />
      </Box>
      {group.responses.map((message) => (
        <StickyMessageResponse
          key={message.id}
          message={message}
          streaming={streaming && message.id === actionMessageId}
          hideQuestionForms={hideQuestionForms}
          showAssistantActions={message.id === actionMessageId}
        />
      ))}
    </Box>
  );
};

const ChatMessageListEntry = (props: ChatMessageListEntryProps) => {
  const {
    item,
    groupCount,
    streaming,
    hideActiveQuestionForms,
    expandedStickyMessageIds,
    animate,
    onToggleStickyMessage,
  } = props;

  if (item.type === "leading-response") {
    return (
      <ChatMessageListResponse
        message={item.message}
        streaming={streaming && groupCount === 0 && item.showAssistantActions}
        hideQuestionForms={groupCount > 0 || hideActiveQuestionForms}
        animate={animate}
        showAssistantActions={item.showAssistantActions}
      />
    );
  }

  return (
    <StickyMessageGroup
      group={item.group}
      streaming={streaming && item.groupIndex === groupCount - 1}
      hideQuestionForms={item.groupIndex < groupCount - 1 || hideActiveQuestionForms}
      isExpanded={expandedStickyMessageIds.has(item.group.userMessage.id)}
      animate={animate}
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
              <ChatMessageListEntry
                item={item}
                groupCount={groups.length}
                streaming={streaming}
                hideActiveQuestionForms={hideActiveQuestionForms}
                expandedStickyMessageIds={expandedStickyMessageIds}
                animate={animatedItemKeys.has(item.key)}
                onToggleStickyMessage={onToggleStickyMessage}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
