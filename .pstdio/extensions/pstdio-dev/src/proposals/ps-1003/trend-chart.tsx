import { Box, Flex, Text } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { areaY, defineChart, dot, lineY, ruleY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import type { TrendMetric, TrendPoint } from "../../benchmarks/analysis";
import { PLATFORMS } from "../../benchmarks/platforms";
import { formatValue } from "../../webview/format";

// Charts paint with theme tokens, so they follow the light and dark themes.
const token = (name: string) => psTheme.token.var(`colors.${name}`);

// Each platform keeps one color on every chart, so the shared legend reads for all of them.
export const platformColor = (platform: string) =>
  token(`vis.categorical.${PLATFORMS.findIndex((entry) => entry.id === platform) + 1}`);

export interface PlatformSeries {
  platform: string;
  metric: TrendMetric;
}

export interface FocusedPoint extends TrendPoint {
  platform: string;
}

interface TrendChartProps {
  series: PlatformSeries[];
  versions: string[];
  height: number;
  onFocusPoint?: (point: FocusedPoint | null) => void;
}

const pointsOf = (entry: PlatformSeries) =>
  entry.metric.points.flatMap((point) => (point ? [{ ...point, platform: entry.platform }] : []));

export const TrendChart = (props: TrendChartProps) => {
  const { series, versions, height, onFocusPoint } = props;
  const measured = series
    .map((entry) => ({ ...entry, points: pointsOf(entry) }))
    .filter((entry) => entry.points.length);
  const [first] = series;
  if (!first || !measured.length)
    return (
      <Flex h={`${height}px`} align="center" justify="center">
        <Text textStyle="label/S/regular" color="fg.muted">
          Not measured on these platforms
        </Text>
      </Flex>
    );
  const { metric } = first;
  const budget = metric.budget === undefined ? [] : [metric.budget];
  // One platform keeps its 95% interval band; several platforms show lines only, so they stay readable.
  const band = measured.length === 1;
  const definition = defineChart({
    marks: [
      ...measured.flatMap((entry) => {
        const color = platformColor(entry.platform);
        return [
          ...(band
            ? [areaY(entry.points, { x: "version", y1: "low", y2: "high", fill: color, fillOpacity: 0.18 })]
            : []),
          lineY(entry.points, { x: "version", y: "median", stroke: color, strokeWidth: 2 }),
          dot(entry.points, { x: "version", y: "median", fill: color, r: 4, stroke: token("bg"), strokeWidth: 2 }),
        ];
      }),
      ruleY(budget, { y: (value) => value, stroke: token("fg.muted"), strokeDasharray: "4 4", strokeWidth: 1 }),
    ],
    scales: {
      x: { scale: () => scalePoint<string>().domain(versions).padding(0.5) },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: { ticks: { format: (value: number) => formatValue(value, metric.unit) } },
      },
    },
  });
  return (
    <Box color="fg.muted" textStyle="label/XS">
      <Chart
        definition={definition}
        height={height}
        ariaLabel={`${metric.label} across releases, median per platform`}
        onFocusChange={(focused) => onFocusPoint?.((focused?.datum as FocusedPoint | undefined) ?? null)}
      />
    </Box>
  );
};
