import { Box, chakra, Stack, Text, useRecipe } from "@chakra-ui/react";
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Tooltip } from "@/components/primitives/tooltip";
import { chatOutlineRecipe } from "@/theme/recipes/chat-outline";
import { useVirtualizer } from "@/utils/use-virtualizer";
import type { ChatMessageRow } from "./chat-message-rows";
import { getOutlineEntries } from "./chat-outline-entries";

export const ChatOutlineHost = ({
  enabled,
  onAvailable,
}: {
  enabled: boolean;
  onAvailable: (host: HTMLDivElement | null) => void;
}) => {
  const root = useRef<HTMLDivElement>(null);
  const styles = useRecipe({ recipe: chatOutlineRecipe })();
  useLayoutEffect(() => {
    if (!enabled) return;
    const host = root.current!;
    const update = () => onAvailable(host.clientWidth ? host : null);
    const observer = new ResizeObserver(update);
    observer.observe(host);
    update();
    return () => {
      observer.disconnect();
      onAvailable(null);
    };
  }, [enabled, onAvailable]);
  return enabled ? <Box ref={root} css={styles} /> : null;
};

interface ChatOutlineProps {
  host: HTMLElement;
  rows: ChatMessageRow[];
  active: number | null;
  onJump: (index: number) => void;
}

export const ChatOutline = ({ host, rows, active, onJump }: ChatOutlineProps) => {
  const entries = getOutlineEntries(rows);
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const viewport = useRef<HTMLDivElement>(null);
  const { virtualizer, virtualItems, totalSize } = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: entries.length,
    getScrollElement: () => viewport.current,
    getItemKey: (index) => entries[index].id,
    estimateSize: () => 16,
    overscan: 4,
  });
  const pendingFocus = useRef<number | null>(null);
  const focusEntry = (index: number) => {
    const button = viewport.current?.querySelector<HTMLButtonElement>(`[data-outline-entry="${index}"]`);
    if (!button) return;
    button.focus({ preventScroll: true });
    pendingFocus.current = null;
  };
  useLayoutEffect(() => {
    if (pendingFocus.current !== null) focusEntry(pendingFocus.current);
  });
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = entries.length - 1;
    else if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) next = index - 1;
    else if (event.key === "ArrowDown" || event.key === "Tab") next = index + 1;
    else return;
    if (next < 0 || next >= entries.length) return;
    event.preventDefault();
    pendingFocus.current = next;
    virtualizer.scrollToIndex(next, { align: "auto" });
    focusEntry(next);
  };
  const selectedEntry = selectedEntryId
    ? entries.findIndex((entry) => entry.index === active && entry.id === selectedEntryId)
    : -1;
  const activeEntry = selectedEntry >= 0 ? selectedEntry : entries.findIndex((entry) => entry.index === active);
  useEffect(() => {
    const scroller = viewport.current;
    if (scroller && activeEntry >= 0 && !scroller.contains(scroller.ownerDocument.activeElement))
      virtualizer.scrollToIndex(activeEntry, { align: "auto" });
  }, [activeEntry, virtualizer]);

  return createPortal(
    <Box as="nav" aria-label="Conversation outline" w="full" h="full" maxH="full" display="flex" pointerEvents="auto">
      <ScrollArea viewportRef={viewport} w="full" h="full" minH="0" showHorizontalScrollbar={false}>
        <Box position="relative" style={{ height: totalSize }}>
          {virtualItems.map((item) => {
            const entry = entries[item.index];
            return (
              <Box
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                position="absolute"
                w="full"
                style={{ top: item.start }}
              >
                <Tooltip
                  positioning={{ placement: "right" }}
                  content={
                    <Stack gap="2xs" maxW="xs">
                      <Text lineClamp={2}>{entry.prompt}</Text>
                      {entry.reply && <Text lineClamp={3}>{entry.reply}</Text>}
                    </Stack>
                  }
                >
                  <chakra.button
                    type="button"
                    data-outline-entry={item.index}
                    onKeyDown={(event) => moveFocus(event, item.index)}
                    aria-label={entry.prompt}
                    aria-current={activeEntry === item.index ? "location" : undefined}
                    onClick={() => {
                      setSelectedEntryId(entry.id);
                      onJump(entry.index);
                    }}
                  >
                    <Box as="span" />
                  </chakra.button>
                </Tooltip>
              </Box>
            );
          })}
        </Box>
      </ScrollArea>
    </Box>,
    host,
  );
};
