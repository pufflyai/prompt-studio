import { Box, Text } from "ink";

import type { TemplateItem as TemplateItemType } from "../hooks/use-templates";

interface TemplateItemProps {
  item: TemplateItemType;
  isSelected: boolean;
  width: number;
}

export function TemplateItem({ item, isSelected, width }: TemplateItemProps) {
  const selector = isSelected ? " ❯ " : "   ";
  const name = item.name.padEnd(14);
  const type = item.template_type.padEnd(10);
  const defaultMarker = item.is_default ? "*" : " ";

  const content = `${selector}${name}${type}${defaultMarker}`;
  const pad = Math.max(0, width - content.length);

  if (isSelected) {
    return (
      <Box>
        <Text backgroundColor="blue" color="white" bold>
          {content}
          {"".padEnd(pad)}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text>
        {selector}
        {name}
        <Text dimColor>{type}</Text>
        <Text color="yellow">{defaultMarker}</Text>
      </Text>
    </Box>
  );
}
