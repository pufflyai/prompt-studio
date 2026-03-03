import { Box, Text } from "ink";

import type { DocRow } from "@/features/docs/types";

interface DocsItemProps {
  row: DocRow;
  isExpanded: boolean;
  isSelected: boolean;
  width: number;
}

interface DocsItemPrefixOptions {
  row: DocRow;
  isExpanded: boolean;
  isSelected: boolean;
}

export const buildDocsItemPrefix = ({ row, isExpanded, isSelected }: DocsItemPrefixOptions) => {
  const indent = "  ".repeat(row.depth);
  const expandIcon = row.hasChildren ? (isExpanded ? "▾ " : "▸ ") : "  ";

  return `${isSelected ? " ❯ " : "   "}${indent}${expandIcon}`;
};

export function DocsItem({ row, isExpanded, isSelected, width }: DocsItemProps) {
  const prefix = buildDocsItemPrefix({ row, isExpanded, isSelected });
  const title = row.item.text;
  const maxTitle = Math.max(0, width - prefix.length - 2);
  const displayed = title.length > maxTitle ? `${title.slice(0, maxTitle - 1)}…` : title;

  if (isSelected) {
    return (
      <Box>
        <Text backgroundColor="blue" color="white" bold>
          {prefix}
          {displayed}
          {"".padEnd(Math.max(0, width - prefix.length - displayed.length))}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text>
        {prefix}
        <Text dimColor={!row.item.link}>{displayed}</Text>
      </Text>
    </Box>
  );
}
