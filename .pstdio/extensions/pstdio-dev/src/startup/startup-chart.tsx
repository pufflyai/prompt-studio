import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { defineChart, dot, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import type { Launch } from "../diagnostics/timeline";
import { formatMs } from "./waterfall";

const color = (value: string) => psTheme.token.var(`colors.${value}`);
const SERIES = [
  { id: "ready", label: "Runtime ready", color: "vis.categorical.1" },
  { id: "setup", label: "Slowest project setup", color: "vis.categorical.2" },
] as const;

const launchTime = (launch: Launch) =>
  new Date(launch.startedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const slowestSetup = (launch: Launch) =>
  launch.setups.reduce<number | null>((slowest, setup) => Math.max(slowest ?? 0, setup.durationMs ?? 0), null);

/** One point per launch, oldest first: time to a ready runtime and the slowest project setup. */
export const StartupChart = (props: { launches: Launch[]; onChoose: (id: string) => void }) => {
  const { launches, onChoose } = props;
  const ordered = [...launches].reverse();
  const points = ordered.flatMap((launch) =>
    SERIES.flatMap((series) => {
      const ms = series.id === "ready" ? launch.readyMs : slowestSetup(launch);
      return ms === null ? [] : [{ launch: launch.id, entry: launch, series: series.id, seconds: ms / 1000 }];
    }),
  );
  const marks = SERIES.flatMap((series) => {
    const data = points.filter((point) => point.series === series.id);
    return [
      lineY(data, { x: "launch", y: "seconds", stroke: color(series.color), strokeWidth: 2 }),
      dot(data, { x: "launch", y: "seconds", fill: color(series.color), r: 3, stroke: color("bg"), strokeWidth: 1 }),
    ];
  });
  const definition = defineChart({
    marks,
    scales: {
      x: {
        scale: () =>
          scalePoint<string>()
            .domain(ordered.map((launch) => launch.id))
            .padding(0.5),
        axis: {
          ticks: {
            format: (id: string) => {
              const launch = ordered.find((entry) => entry.id === id);
              return launch ? launchTime(launch) : id;
            },
          },
        },
      },
      y: { scale: scaleLinear, nice: true, grid: true, axis: { ticks: { format: (value: number) => `${value}s` } } },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (focused) => {
        const launch = focused[0]!.datum.entry;
        return {
          title: new Date(launch.startedAt).toLocaleString(),
          rows: [
            { label: "Runtime ready", value: formatMs(launch.readyMs), color: color(SERIES[0].color) },
            { label: "Slowest project setup", value: formatMs(slowestSetup(launch)), color: color(SERIES[1].color) },
            { label: "Project setups", value: String(launch.setups.length) },
          ],
        };
      },
    },
  });
  return (
    <Stack gap="2xs">
      <Text textStyle="label/M/medium">Launch history</Text>
      <Box color="fg.muted" textStyle="label/XS">
        <Chart
          definition={definition}
          height={220}
          ariaLabel="Time to a ready runtime and slowest project setup per launch, oldest first"
          onFocusChange={(focused) => {
            if (focused) onChoose(focused.datum.launch);
          }}
        />
      </Box>
      <HStack gap="md">
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
