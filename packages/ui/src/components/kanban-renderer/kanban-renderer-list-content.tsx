import { Box, HStack, Icon, Text, Wrap } from "@chakra-ui/react";
import { KanbanRendererAttributeBadge } from "./kanban-renderer-attribute-badge";
import type { KanbanRendererListItem } from "./kanban-renderer-list";
import { KanbanRendererListCells } from "./kanban-renderer-list-cells";

interface ListContentProps {
  item: KanbanRendererListItem;
}

export const KanbanRendererListLabel = (props: ListContentProps) => {
  const { item } = props;
  if (item.isGroup) {
    return (
      <HStack gap="xs" minW="0" maxW="full" flex="1">
        <Text textStyle="label/S/medium" minW="0" truncate>
          {item.title}
        </Text>
        <Text textStyle="label/XS" color="fg.muted" flexShrink={0}>
          {item.countBadge}
        </Text>
      </HStack>
    );
  }
  return (
    <HStack gap="compact" minW="0" maxW="full" flex="1">
      <KanbanRendererListCells cells={item.startCells} onBadgeChange={item.onBadgeChange} />
      {item.eyebrow ? (
        <Text data-testid="list-row-eyebrow" flexShrink={0} textStyle="mono/XS" color="fg.muted" truncate>
          {item.eyebrow}
        </Text>
      ) : null}
      <Text textStyle="paragraph/S/regular" minW="0" truncate>
        {item.title}
      </Text>
    </HStack>
  );
};

export const hasKanbanRendererListEndContent = (item: KanbanRendererListItem) =>
  Boolean(item.badges?.length || item.customSlots?.length || item.endCells?.length);

export const KanbanRendererListEndContent = (props: ListContentProps) => {
  const { item } = props;
  return (
    <HStack gap="xs" flexShrink={0}>
      {item.badges?.length || item.customSlots?.length ? (
        <Wrap gap="2xs" flexShrink={0}>
          {item.badges?.map((badge) => (
            <KanbanRendererAttributeBadge key={badge.attributeId} badge={badge} onChange={item.onBadgeChange} />
          ))}
          {item.customSlots}
        </Wrap>
      ) : null}
      <KanbanRendererListCells cells={item.endCells} onBadgeChange={item.onBadgeChange} />
    </HStack>
  );
};

export const KanbanRendererListIcon = (props: ListContentProps) => {
  const { item } = props;
  if (!item.statusIcon) return <Box boxSize="icon-sm" />;
  return (
    <Icon
      data-testid={item.isGroup ? "list-status-icon" : "row-status-icon"}
      as={item.statusIcon}
      boxSize="icon-sm"
      colorPalette={item.statusColorPalette ?? item.countColorPalette ?? "gray"}
      color={item.statusColor ?? (item.isGroup || item.statusColorPalette ? "colorPalette.solid" : "fg.muted")}
    />
  );
};
