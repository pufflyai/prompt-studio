import { Box } from "@chakra-ui/react";
import { lazy, Suspense } from "react";
import type { DataTableStatChartProps } from "./data-table-stat-chart-content";

const ChartContent = lazy(() =>
  import("./data-table-stat-chart-content").then((module) => ({ default: module.DataTableStatChart })),
) as typeof import("./data-table-stat-chart-content").DataTableStatChart;

export const DataTableStatChart = <T extends object>(props: DataTableStatChartProps<T>) => {
  const { height, ariaLabel } = props;
  // Keep table geometry and labels available while the chart code loads.
  return (
    <Box height={height} width="full" minWidth="0" aria-label={ariaLabel}>
      <Suspense fallback={null}>
        <ChartContent {...props} />
      </Suspense>
    </Box>
  );
};
