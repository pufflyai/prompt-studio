import { Badge } from "@chakra-ui/react";
import type { DataTableBadgeCategory } from "./types";

interface DataTableBadgeCellProps {
  value: string | number | boolean;
  categories?: DataTableBadgeCategory[];
}

export const DataTableBadgeCell = (props: DataTableBadgeCellProps) => {
  const { value, categories } = props;
  const palette = categories?.find((category) => category.value === value)?.palette ?? "gray";

  return (
    <Badge variant="subtle" size="sm" colorPalette={palette} maxW="full" truncate>
      {String(value)}
    </Badge>
  );
};
