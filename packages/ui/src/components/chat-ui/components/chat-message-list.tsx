import { Box } from "@chakra-ui/react";
import { defaultRangeExtractor } from "@tanstack/react-virtual";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { useVirtualizer } from "@/utils/use-virtualizer";
import { useMessageAnimationKeys } from "./chat-message-animation";
import { ChatMessageListResponse } from "./chat-message-list-items";
import { buildChatMessageRows, getChatStickyRowIndex, hasChatRowGap } from "./chat-message-rows";
import type { MessageGroup, SessionMessage } from "./message-types";
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

const ESTIMATED_MESSAGE_HEIGHT = 360;
const VIRTUAL_LIST_OVERSCAN = 4;
const VIRTUAL_LIST_GAP = 8;

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
  const rows = buildChatMessageRows(leadingResponses, groups);
  const animatedKeys = useMessageAnimationKeys(rows.map((row) => row.key));
  const initialHeight = scrollRef.current?.clientHeight || 1;
  const gapCount = Math.max(leadingResponses.length + groups.length - 1, 0);
  const { virtualizer, virtualItems, totalSize, measurements } = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    getScrollElement: () => scrollRef.current as HTMLDivElement | null,
    estimateSize: (index) => ESTIMATED_MESSAGE_HEIGHT + (hasChatRowGap(rows, index) ? VIRTUAL_LIST_GAP : 0),
    getItemKey: (index) => rows[index].key,
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

  useTailReady({ itemCount: rows.length, onReady, scrollRef, totalSize });

  return (
    <Box px="xs">
      <Box position="relative" width="100%" style={{ height: totalSize }}>
        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index];
          if (row.type === "user") {
            const end =
              (measurements[row.endIndex]?.end ?? totalSize) -
              (hasChatRowGap(rows, row.endIndex) ? VIRTUAL_LIST_GAP : 0);
            return (
              <Box
                key={virtualItem.key}
                position="absolute"
                left="0"
                width="100%"
                zIndex={1}
                pointerEvents="none"
                style={{ top: virtualItem.start, height: Math.max(virtualItem.size, end - virtualItem.start) }}
              >
                {/* Native sticky layout follows every scroll frame, including within one response. */}
                <Box
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  data-chat-message-list-item="user"
                  data-chat-message-id={row.key}
                  position="sticky"
                  top="0"
                  pointerEvents="auto"
                  pb={hasChatRowGap(rows, virtualItem.index) ? "xs" : undefined}
                >
                  <StickyUserMessage
                    message={row.message}
                    expanded={expandedStickyMessageIds.has(row.key)}
                    animate={animatedKeys.has(row.key)}
                    onToggle={onToggleStickyMessage}
                  />
                </Box>
              </Box>
            );
          }
          return (
            <Box
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              data-chat-message-list-item={row.type}
              data-chat-message-id={row.key}
              position="absolute"
              left="0"
              width="100%"
              pb={hasChatRowGap(rows, virtualItem.index) ? "xs" : undefined}
              style={{ top: virtualItem.start }}
            >
              <ChatMessageListResponse
                message={row.message}
                streaming={streaming && row.isActiveTurn && row.showAssistantActions}
                hideQuestionForms={!row.isActiveTurn || hideActiveQuestionForms}
                animate={animatedKeys.has(row.key)}
                showAssistantActions={row.showAssistantActions}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
