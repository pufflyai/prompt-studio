import { HStack, Icon, Menu, Text } from "@chakra-ui/react";
import { ListRow, type ListRowItem } from "@pstdio/ui";
import { Check } from "lucide-react";
import { Fragment } from "react";
import { ShortcutKbd } from "@/features/shortcuts/shortcut-kbd";
import type { buildCommandPaletteEntries } from "./command-palette-model";

type CommandPaletteEntry = ReturnType<typeof buildCommandPaletteEntries>[number];

const buildEntryItem = (entry: CommandPaletteEntry): ListRowItem => ({
  id: entry.id,
  label: entry.label,
  description: entry.secondaryLabel,
  icon: <Icon as={entry.icon} boxSize="14px" />,
  endContent:
    entry.shortcut || entry.isSelected ? (
      <HStack gap="2">
        {entry.shortcut ? <ShortcutKbd binding={entry.shortcut} /> : null}
        {entry.isSelected ? <Icon as={Check} boxSize="14px" color="fg.muted" /> : null}
      </HStack>
    ) : undefined,
  onActivate: entry.run,
});

interface CommandPaletteEntriesListProps {
  entries: CommandPaletteEntry[];
  activeIndex: number;
  emptyLabel: string;
  onHover: (index: number) => void;
}

export const CommandPaletteEntriesList = (props: CommandPaletteEntriesListProps) => {
  const { entries, activeIndex, emptyLabel, onHover } = props;

  if (entries.length === 0) {
    return (
      <Text textStyle="paragraph/S/regular" color="fg.muted" px="sm" py="md">
        {emptyLabel}
      </Text>
    );
  }

  return (
    <>
      {entries.map((entry, index) => {
        const previousEntry = entries[index - 1];
        const showGroupHeader = entry.group && entry.group !== previousEntry?.group;
        return (
          <Fragment key={entry.id}>
            {showGroupHeader ? (
              <Text textStyle="label/XS/medium" color="fg.muted" px="sm" pt="xs" pb="2xs">
                {entry.group}
              </Text>
            ) : null}
            <Menu.Item value={entry.id} asChild onMouseEnter={() => onHover(index)}>
              <ListRow asChild variant="compact" {...buildEntryItem(entry)} isSelected={index === activeIndex} />
            </Menu.Item>
          </Fragment>
        );
      })}
    </>
  );
};
