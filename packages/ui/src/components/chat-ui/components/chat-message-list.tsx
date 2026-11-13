import { Box } from "@chakra-ui/react";
import { defaultRangeExtractor, measureElement } from "@tanstack/react-virtual";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { useVirtualizer } from "@/utils/use-virtualizer";
import { useMessageAnimationKeys } from "./chat-message-animation";
import { ChatMessageRowLayout } from "./chat-message-row-layout";
import { buildChatMessageRows, getChatStickyRowIndex, hasChatRowGap } from "./chat-message-rows";
import type { MessageGroup, SessionMessage } from "./message-types";
import { useTailReady } from "./use-chat-tail-ready";

interface ChatMessageListProps {
  leadingResponses: SessionMessage[];
  groups: MessageGroup[];
  streaming: boolean;
  hideActiveQuestionForms: boolean;
  expandedStickyMessageIds: Set<string>;
  onToggleStickyMessage: (messageId: string) => void;
  onReady?: () => void;
  onForkMessage?: (messageId: string) => void | Promise<void>;
  forkDisabledReason?: string;
}

const ESTIMATED_MESSAGE_HEIGHT = 360;
const VIRTUAL_LIST_OVERSCAN = 4;
const VIRTUAL_LIST_GAP = 8;
const retainTailOffset = () => false;

export const ChatMessageList = (props: ChatMessageListProps) => {
  const {
    leadingResponses,
    groups,
    streaming,
    hideActiveQuestionForms,
    expandedStickyMessageIds,
    onToggleStickyMessage,
    onReady,
    onForkMessage,
    forkDisabledReason,
  } = props;
  const { scrollRef, state } = useStickToBottomContext();
  const rows = buildChatMessageRows(leadingResponses, groups);
  const animatedKeys = useMessageAnimationKeys(rows.map((row) => row.message.animationKey ?? row.key));
  const initialHeight = scrollRef.current?.clientHeight || 1;
  const gapCount = Math.max(leadingResponses.length + groups.length - 1, 0);
  const { virtualizer, virtualItems, totalSize, measurements } = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    getScrollElement: () => scrollRef.current as HTMLDivElement | null,
    estimateSize: (index) => ESTIMATED_MESSAGE_HEIGHT + (hasChatRowGap(rows, index) ? VIRTUAL_LIST_GAP : 0),
    measureElement: (element, entry, instance) => {
      // Read the live follower at measurement time; lock changes need not render this component.
      // The virtualizer retains its normal reader anchoring when the conversation stops following.
      instance.shouldAdjustScrollPositionOnItemSizeChange = state.isAtBottom ? retainTailOffset : undefined;
      return measureElement(element, entry, instance);
    },
    getItemKey: (index) => rows[index].message.animationKey ?? rows[index].key,
    overscan: VIRTUAL_LIST_OVERSCAN,
    initialRect: { width: 0, height: initialHeight },
    initialOffset: () =>
      Math.max(rows.length * ESTIMATED_MESSAGE_HEIGHT + gapCount * VIRTUAL_LIST_GAP - initialHeight, 0),
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      const stickyIndex = getChatStickyRowIndex(rows, range.startIndex);
      if (stickyIndex !== null && !indexes.includes(stickyIndex)) indexes.unshift(stickyIndex);
      return indexes;
    },
  });

  useTailReady({ onReady, scrollRef });

  return (
    <Box px="xs">
      <Box position="relative" width="100%" style={{ height: totalSize }}>
        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index];
          let height: number | undefined;
          if (row.type === "user") {
            const end =
              (measurements[row.endIndex]?.end ?? totalSize) -
              (hasChatRowGap(rows, row.endIndex) ? VIRTUAL_LIST_GAP : 0);
            height = Math.max(virtualItem.size, end - virtualItem.start);
          }
          return (
            <ChatMessageRowLayout
              key={virtualItem.key}
              rowType={row.type}
              rowId={row.key}
              message={row.message}
              index={virtualItem.index}
              start={virtualItem.start}
              height={height}
              hasGap={hasChatRowGap(rows, virtualItem.index)}
              measureElement={virtualizer.measureElement}
              expanded={row.type === "user" && expandedStickyMessageIds.has(row.message.animationKey ?? row.key)}
              animatedKeys={animatedKeys}
              onToggleStickyMessage={onToggleStickyMessage}
              streaming={row.type === "response" && streaming && row.isActiveTurn && row.showAssistantActions}
              hideQuestionForms={row.type === "response" && (!row.isActiveTurn || hideActiveQuestionForms)}
              showAssistantActions={row.type === "response" && row.showAssistantActions}
              onForkMessage={onForkMessage}
              forkDisabledReason={forkDisabledReason}
            />
          );
        })}
      </Box>
    </Box>
  );
};
