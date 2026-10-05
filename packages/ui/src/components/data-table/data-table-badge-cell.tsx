import { Badge } from "@chakra-ui/react";
import { HighlightedText } from "../collection-view/highlighted-text";
import type { DataTableBadgeCategory } from "./types";

interface DataTableBadgeCellProps {
  value: string | number | boolean;
  search?: string;
  categories?: DataTableBadgeCategory[];
}

export const DataTableBadgeCell = (props: DataTableBadgeCellProps) => {
  const { value, categories, search = "" } = props;
  const palette = categories?.find((category) => category.value === value)?.palette ?? "gray";

  return (
    <Badge variant="subtle" size="sm" colorPalette={palette} maxW="full" truncate>
      <HighlightedText text={String(value)} query={search} />
    </Badge>
  );
};
