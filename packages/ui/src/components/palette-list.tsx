import { Box, HStack, Icon, Menu, Text } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check } from "lucide-react";
import { type RefObject, useEffect } from "react";
import { ListRow } from "./list-row/list-row";
import type { ListRowItem } from "./list-row/list-row.types";
import type { PaletteEntry } from "./palette";

type PaletteRow<T extends PaletteEntry> =
  | { type: "group"; id: string; label: string }
  | { type: "entry"; id: string; entry: T; entryIndex: number };

const GROUP_ROW_HEIGHT = 24;
const ENTRY_ROW_HEIGHT = 40;
const INITIAL_VIEWPORT_HEIGHT = 384;

const buildEntryItem = (entry: PaletteEntry): ListRowItem => ({
  id: entry.id,
  label: entry.label,
  description: entry.description ?? entry.secondaryLabel,
  icon: entry.icon,
  endContent:
    entry.endContent ??
    (entry.shortcut || entry.isSelected ? (
      <HStack gap="2">
        {entry.shortcut}
        {entry.isSelected ? <Icon as={Check} boxSize="14px" color="fg.muted" /> : null}
      </HStack>
    ) : undefined),
  onActivate: entry.onActivate,
});

const buildRows = <T extends PaletteEntry>(entries: T[]) => {
  const rows: PaletteRow<T>[] = [];

  entries.forEach((entry, index) => {
    const previousEntry = entries[index - 1];
    if (entry.group && entry.group !== previousEntry?.group) {
      rows.push({ type: "group", id: `group:${entry.group}:${entry.id}`, label: entry.group });
    }

    rows.push({ type: "entry", id: entry.id, entry, entryIndex: index });
  });

  return rows;
};

const getActiveRowIndex = <T extends PaletteEntry>(rows: PaletteRow<T>[], activeIndex: number) =>
  rows.findIndex((row) => row.type === "entry" && row.entryIndex === activeIndex);

interface PaletteListProps<T extends PaletteEntry> {
  entries: T[];
  activeIndex: number;
  emptyLabel: string;
  onHover: (index: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export const PaletteList = <T extends PaletteEntry>(props: PaletteListProps<T>) => {
  const { entries, activeIndex, emptyLabel, onHover, scrollRef } = props;
  const rows = buildRows(entries);
  const activeRowIndex = getActiveRowIndex(rows, activeIndex);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (rows[index]?.type === "group" ? GROUP_ROW_HEIGHT : ENTRY_ROW_HEIGHT),
    getItemKey: (index) => rows[index]?.id ?? index,
    initialRect: { width: 0, height: INITIAL_VIEWPORT_HEIGHT },
    overscan: 6,
  });

  useEffect(() => {
    if (activeRowIndex < 0) return;

    virtualizer.scrollToIndex(activeRowIndex, { align: "auto", behavior: "auto" });
  }, [activeRowIndex, virtualizer]);

  if (entries.length === 0) {
    return (
      <Text textStyle="paragraph/S/regular" color="fg.muted" px="sm" py="md">
        {emptyLabel}
      </Text>
    );
  }

  return (
    <Box position="relative" width="100%" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;

        return (
          <Box
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            position="absolute"
            left="0"
            width="100%"
            style={{ top: virtualRow.start }}
          >
            {row.type === "group" ? (
              <Text textStyle="label/XS/medium" color="fg.muted" px="sm" pt="xs" pb="2xs">
                {row.label}
              </Text>
            ) : (
              <Menu.Item value={row.entry.id} asChild onPointerMove={() => onHover(row.entryIndex)}>
                <ListRow
                  asChild
                  variant="compact"
                  {...buildEntryItem(row.entry)}
                  isSelected={row.entryIndex === activeIndex}
                />
              </Menu.Item>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
