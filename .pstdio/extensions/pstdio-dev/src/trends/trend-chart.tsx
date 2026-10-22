import { Box } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { areaY, defineChart, dot, lineY, ruleY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import type { TrendMetric, TrendPoint } from "../benchmarks/analysis";
import { formatValue } from "../webview/format";

// Charts paint with theme tokens, so they follow the light and dark themes.
const token = (name: string) => psTheme.token.var(`colors.${name}`);
const seriesColor = token("vis.categorical.1");

interface TrendChartProps {
  metric: TrendMetric;
  versions: string[];
  height: number;
  compact?: boolean;
  onFocusPoint?: (point: TrendPoint | null) => void;
}

export const TrendChart = (props: TrendChartProps) => {
  const { metric, versions, height, compact = false, onFocusPoint } = props;
  const points = metric.points.filter((point): point is TrendPoint => point !== null);
  const budget = metric.budget === undefined ? [] : [metric.budget];
  const definition = defineChart({
    marks: [
      areaY(points, { x: "version", y1: "low", y2: "high", fill: seriesColor, fillOpacity: 0.18 }),
      lineY(points, { x: "version", y: "median", stroke: seriesColor, strokeWidth: 2 }),
      dot(points, {
        x: "version",
        y: "median",
        fill: seriesColor,
        r: compact ? 2 : 4,
        stroke: token("bg"),
        strokeWidth: 2,
      }),
      ruleY(budget, { y: (value) => value, stroke: token("fg.muted"), strokeDasharray: "4 4", strokeWidth: 1 }),
    ],
    scales: {
      x: {
        scale: () => scalePoint<string>().domain(versions).padding(0.5),
        axis: compact ? false : undefined,
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: !compact,
        axis: compact ? false : { ticks: { format: (value: number) => formatValue(value, metric.unit) } },
      },
    },
  });
  return (
    <Box color="fg.muted" textStyle="label/XS">
      <Chart
        definition={definition}
        height={height}
        ariaLabel={`${metric.label} across releases, median with 95% confidence interval`}
        onFocusChange={(focused) => onFocusPoint?.((focused?.datum as TrendPoint | undefined) ?? null)}
      />
    </Box>
  );
};
