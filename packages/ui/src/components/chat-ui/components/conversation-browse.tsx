import { Box, chakra, Flex, Portal, Stack, Text } from "@chakra-ui/react";
import { type PointerEvent, useState } from "react";

export interface ConversationBrowseItem {
  /** Turn id used to scroll the log to this user message. */
  id: string;
  /** The user message this tick indexes (shown in the hover card). */
  message: string;
  /** Optional assistant reply preview; hidden for a turn not yet answered. */
  reply?: string;
}

interface ConversationBrowseProps {
  items: ConversationBrowseItem[];
  onSelect?: (id: string) => void;
  /** Overlay the log's left edge with a scrim instead of reserving a gutter (panels under ~480px). */
  floating?: boolean;
}

// The rail is a lens, not a chart: tick length encodes distance from the pointer, never content.
const MIN_USER_MESSAGES = 3;
const TICK_MIN_WIDTH = 10;
const TICK_MAX_WIDTH = 26;
const LENS_RADIUS = 4;

interface BrowseCardPosition {
  left: number;
  top: number;
}

// Raised-cosine falloff over LENS_RADIUS neighbours: 1 at the pointer, 0 at the edge of the lens.
const lensFactor = (index: number, pointerIndex: number | null) => {
  if (pointerIndex === null) return 0;
  const distance = Math.abs(index - pointerIndex);
  if (distance >= LENS_RADIUS) return 0;
  return (1 + Math.cos((Math.PI * distance) / LENS_RADIUS)) / 2;
};

const tickColor = (index: number, pointerIndex: number | null) => {
  if (pointerIndex === null) return "fg.subtle";
  const distance = Math.abs(index - pointerIndex);
  if (distance < 0.5) return "fg";
  if (distance < LENS_RADIUS) return "fg.muted";
  return "fg.subtle";
};

const ConversationBrowseCard = (props: { item: ConversationBrowseItem; position: BrowseCardPosition }) => {
  const { item, position } = props;

  return (
    <Portal>
      <Box
        position="fixed"
        left={`${position.left}px`}
        ml="2xs"
        top={`${position.top}px`}
        transform="translateY(-50%)"
        w="80"
        maxW="80"
        zIndex="popover"
        pointerEvents="none"
      >
        <Stack gap="1.5" p="3" bg="bg.elevated" borderWidth="1px" borderColor="border" borderRadius="lg">
          <Text textStyle="label/S/medium" color="fg" lineClamp={2}>
            {item.message}
          </Text>
          {item.reply ? (
            <Text textStyle="label/XS/regular" color="fg.muted" lineClamp={2}>
              {item.reply}
            </Text>
          ) : null}
        </Stack>
      </Box>
    </Portal>
  );
};

/**
 * ChatBrowse — the conversation scrubber for the chat log's left gutter. One tick per user
 * message, in order; the ticks nearest the pointer swell into a lens (growing along X only, so
 * the row you aim at never moves), and the active tick raises a preview card. Clicking a tick
 * selects that turn. Hidden below a few messages, where a gutter costs space and buys nothing.
 */
export const ConversationBrowse = (props: ConversationBrowseProps) => {
  const { items, onSelect, floating = false } = props;
  const [pointerIndex, setPointerIndex] = useState<number | null>(null);
  const [cardPosition, setCardPosition] = useState<BrowseCardPosition | null>(null);

  if (items.length < MIN_USER_MESSAGES) return null;

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientY - rect.top) / rect.height;
    const next = Math.min(items.length - 1, Math.max(0, fraction * items.length - 0.5));
    const nextActiveIndex = Math.round(next);
    setPointerIndex(next);
    setCardPosition({
      left: rect.right,
      top: rect.top + ((nextActiveIndex + 0.5) / items.length) * rect.height,
    });
  };

  const activeIndex = pointerIndex === null ? null : Math.round(pointerIndex);
  const activeItem = activeIndex === null ? null : items[activeIndex];

  return (
    <Box position="relative" w="10" flexShrink={0}>
      <Flex
        direction="column"
        align="flex-start"
        gap="1.5"
        px="1.5"
        py="2"
        w="10"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setPointerIndex(null)}
        {...(floating
          ? {
              position: "absolute",
              insetInlineStart: 0,
              top: 0,
              bottom: 0,
              // The scrim must be the surface the rail covers — the panel's own bg, never a lighter tone.
              bg: "bg",
            }
          : {})}
      >
        {items.map((item, index) => (
          <chakra.button
            type="button"
            key={item.id}
            h="2px"
            w={`${TICK_MIN_WIDTH + (TICK_MAX_WIDTH - TICK_MIN_WIDTH) * lensFactor(index, pointerIndex)}px`}
            bg={tickColor(index, pointerIndex)}
            borderRadius="1px"
            transition="width 80ms linear, background-color 80ms linear"
            aria-label={`Jump to message ${index + 1}`}
            onClick={() => onSelect?.(item.id)}
          />
        ))}
      </Flex>
      {activeItem && cardPosition ? <ConversationBrowseCard item={activeItem} position={cardPosition} /> : null}
    </Box>
  );
};
