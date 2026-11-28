import { Box } from "@chakra-ui/react";
import { defaultRangeExtractor, measureElement } from "@tanstack/react-virtual";
import { useState } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { useVirtualizer } from "@/utils/use-virtualizer";
import { useMessageAnimationKeys } from "./chat-message-animation";
import { ChatMessageRowLayout } from "./chat-message-row-layout";
import {
  type ChatMessageRow,
  getChatStickyRowIndex,
  hasChatRowGap,
  isChatMessageContinuation,
} from "./chat-message-rows";
import { ChatOutline } from "./chat-outline";
import { ChatToolExpansionContext } from "./chat-tool-expansion";
import { useChatMessageVisibility } from "./use-chat-message-visibility";
import { useTailReady } from "./use-chat-tail-ready";

interface ChatMessageListProps {
  outlineHost?: HTMLElement | null;
  rows: ChatMessageRow[];
  hideActiveQuestionForms: boolean;
  expandedStickyMessageIds: Set<string>;
  onToggleStickyMessage: (messageId: string) => void;
  onReady?: () => void;
  onVisibleMessageIdsChange?: (ids: string[]) => void;
  onForkMessage?: (messageId: string) => void | Promise<void>;
  forkDisabledReason?: string;
}

const ESTIMATED_MESSAGE_HEIGHT = 360;
const VIRTUAL_LIST_OVERSCAN = 4;
const VIRTUAL_LIST_GAP = 8;
const retainTailOffset = () => false;

export const ChatMessageList = (props: ChatMessageListProps) => {
  const {
    rows,
    hideActiveQuestionForms,
    expandedStickyMessageIds,
    onToggleStickyMessage,
    onReady,
    onForkMessage,
    forkDisabledReason,
  } = props;
  const { scrollRef, state, stopScroll, isAtBottom } = useStickToBottomContext();
  const rowKeys = rows.map((row) => (row.type === "user" ? (row.message.animationKey ?? row.key) : row.key));
  const animatedKeys = useMessageAnimationKeys(rowKeys);
  const [toolExpansion] = useState(() => new Map<string, Set<string>>());
  const initialHeight = scrollRef.current?.clientHeight || 1;
  const gapCount = rows.reduce((count, _row, index) => count + Number(hasChatRowGap(rows, index)), 0);
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
    getItemKey: (index) => rowKeys[index],
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
  const visibleRows = props.onVisibleMessageIdsChange
    ? JSON.stringify(virtualItems.map((item) => rows[item.index].key))
    : "[]";
  const list = useChatMessageVisibility(scrollRef, visibleRows, props.onVisibleMessageIdsChange);

  const range = virtualizer.range;
  const viewingTail =
    isAtBottom || (props.outlineHost && range?.endIndex === rows.length - 1 && virtualizer.isAtEnd(2));
  const currentRow = viewingTail ? rows.length - 1 : (range?.startIndex ?? 0);

  return (
    <Box px="xs" ref={list}>
      {props.outlineHost && (
        <ChatOutline
          host={props.outlineHost}
          rows={rows}
          active={getChatStickyRowIndex(rows, currentRow)}
          onJump={(index) => {
            stopScroll();
            virtualizer.scrollToIndex(index, { align: "start" });
          }}
        />
      )}
      <ChatToolExpansionContext value={toolExpansion}>
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
                occurrences={row.messageIds.length}
                rowId={row.key}
                animationKey={rowKeys[virtualItem.index]}
                continues={isChatMessageContinuation(row)}
                partRange={row.type === "response" ? row.partRange : undefined}
                message={row.message}
                index={virtualItem.index}
                start={virtualItem.start}
                height={height}
                hasGap={hasChatRowGap(rows, virtualItem.index)}
                measureElement={virtualizer.measureElement}
                expanded={row.type === "user" && expandedStickyMessageIds.has(row.message.animationKey ?? row.key)}
                animatedKeys={animatedKeys}
                onToggleStickyMessage={onToggleStickyMessage}
                streaming={row.type === "response" && row.streaming}
                hideQuestionForms={row.type === "response" && (!row.isActiveTurn || hideActiveQuestionForms)}
                showAssistantActions={row.type === "response" && row.showAssistantActions}
                onForkMessage={onForkMessage}
                forkDisabledReason={forkDisabledReason}
              />
            );
          })}
        </Box>
      </ChatToolExpansionContext>
    </Box>
  );
};
