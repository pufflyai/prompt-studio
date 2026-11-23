import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { defineChart, dot, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { Aggregation } from "../webview/period";
import { periodChartMargin, periodTitle, timelineScale } from "../webview/period-chart";
import { type StartupBucket, startupBucketMetrics } from "./startup-timeline";
import { formatMs } from "./waterfall";

const color = (value: string) => psTheme.token.var(`colors.${value}`);
const SERIES = [
  { id: "ready", label: "Average runtime ready", color: "vis.categorical.1" },
  { id: "setup", label: "Average slowest project setup", color: "vis.categorical.2" },
] as const;

interface StartupChartProps {
  buckets: StartupBucket[];
  aggregation: Aggregation;
  onChoose: (id: string) => void;
}

/** One point per period, oldest first: average time to a ready runtime and average slowest project setup. */
export const StartupChart = (props: StartupChartProps) => {
  const { buckets, aggregation, onChoose } = props;
  const metrics = buckets.map(startupBucketMetrics);
  const byDate = new Map(metrics.map((bucket) => [bucket.date, bucket]));
  const points = metrics.flatMap((bucket) =>
    SERIES.flatMap((series) => {
      const ms = bucket[series.id];
      return ms === null ? [] : [{ date: bucket.date, series: series.id, seconds: ms / 1000 }];
    }),
  );
  const marks = SERIES.flatMap((series) => {
    const data = points.filter((point) => point.series === series.id);
    return [
      lineY(data, { x: "date", y: "seconds", stroke: color(series.color), strokeWidth: 2 }),
      dot(data, { x: "date", y: "seconds", fill: color(series.color), r: 3, stroke: color("bg"), strokeWidth: 1 }),
    ];
  });
  const definition = defineChart({
    margin: periodChartMargin,
    marks,
    scales: {
      x: timelineScale(buckets, aggregation),
      y: { scale: scaleLinear, nice: true, grid: true, axis: { ticks: { format: (value: number) => `${value}s` } } },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (focused) => {
        const bucket = byDate.get(String(focused[0]!.datum.date))!;
        return {
          title: periodTitle(bucket.date, aggregation),
          rows: [
            { label: "Launches", value: String(bucket.launches.length) },
            { label: "Average ready", value: formatMs(bucket.ready), color: color(SERIES[0].color) },
            { label: "Slowest ready", value: formatMs(bucket.slowestReady) },
            { label: "Average slowest setup", value: formatMs(bucket.setup), color: color(SERIES[1].color) },
          ],
        };
      },
    },
  });
  return (
    <Stack gap="2xs">
      <Text textStyle="label/M/medium">Startup history</Text>
      <Box color="fg.muted" textStyle="label/XS">
        <Chart
          definition={definition}
          height={220}
          ariaLabel={`Average runtime ready and slowest project setup by ${aggregation}, UTC`}
          onFocusChange={(focused) => {
            const launch = byDate.get(String(focused?.xValue))?.launches.at(0);
            if (launch) onChoose(launch.id);
          }}
        />
      </Box>
      <HStack gap="md" flexWrap="wrap">
        {SERIES.map((series) => (
          <HStack key={series.id} gap="2xs">
            <Box boxSize="8px" borderRadius="full" bg={series.color} />
            <Text textStyle="label/S/regular" color="fg.muted">
              {series.label}
            </Text>
          </HStack>
        ))}
      </HStack>
    </Stack>
  );
};
