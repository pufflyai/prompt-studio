import { Box, Button, HStack } from "@chakra-ui/react";

interface SeriesLegendProps<Id extends string> {
  label: string;
  items: readonly { id: Id; label: string; color: string }[];
  selected?: Id;
  onSelect: (id: Id | undefined) => void;
}

export const SeriesLegend = <Id extends string>(props: SeriesLegendProps<Id>) => {
  const { label, items, selected, onSelect } = props;
  return (
    <HStack gap="2xs" flexWrap="wrap" role="group" aria-label={label}>
      {items.map((item) => {
        const active = selected === item.id;
        const dimmed = selected !== undefined && !active;
        return (
          <Button
            key={item.id}
            type="button"
            size="xs"
            variant={active ? "subtle" : "ghost"}
            aria-pressed={active}
            title={active ? "Show all categories" : `Show only ${item.label}`}
            color={dimmed ? "fg.muted" : undefined}
            onClick={() => onSelect(active ? undefined : item.id)}
          >
            <Box aria-hidden="true" boxSize="2" borderRadius="sm" bg={dimmed ? "fg.subtle" : item.color} />
            {item.label}
          </Button>
        );
      })}
    </HStack>
  );
};
