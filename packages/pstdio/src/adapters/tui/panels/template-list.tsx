import { Box, Text } from "ink";

import { TemplateItem } from "../components/template-item";
import type { TemplateItem as TemplateItemType } from "../hooks/use-templates";

interface TemplateListProps {
  items: TemplateItemType[];
  selectedIndex: number;
  viewportHeight: number;
  scrollOffset: number;
  width: number;
}

export function TemplateList({ items, selectedIndex, viewportHeight, scrollOffset, width }: TemplateListProps) {
  if (items.length === 0) {
    return (
      <Box height={viewportHeight} alignItems="center" justifyContent="center">
        <Text dimColor>No templates found.</Text>
      </Box>
    );
  }

  const visible = items.slice(scrollOffset, scrollOffset + viewportHeight);
  const emptyLines = Math.max(0, viewportHeight - visible.length);

  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + viewportHeight < items.length;

  return (
    <Box flexDirection="column" height={viewportHeight}>
      {showScrollUp && (
        <Box justifyContent="center">
          <Text dimColor>{`  ▲ ${scrollOffset} more`}</Text>
        </Box>
      )}

      {visible.map((item, i) => (
        <TemplateItem key={item.id} item={item} isSelected={scrollOffset + i === selectedIndex} width={width} />
      ))}

      {showScrollDown && (
        <Box justifyContent="center">
          <Text dimColor>{`  ▼ ${items.length - scrollOffset - viewportHeight} more`}</Text>
        </Box>
      )}

      {emptyLines > 0 && <Box height={emptyLines} />}
    </Box>
  );
}
