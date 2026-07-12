import type { ReactNode } from "react";
import type { DataTableCategoricalColor } from "./types";

interface CategoricalColorCellProps {
  children: ReactNode;
}

export const resolveCategoricalColor = (value: unknown, categories: DataTableCategoricalColor[]) => {
  return categories.find((category) => Object.is(category.value, value))?.color ?? null;
};

export const CategoricalColorCell = (props: CategoricalColorCellProps) => {
  const { children } = props;

  return children;
};
