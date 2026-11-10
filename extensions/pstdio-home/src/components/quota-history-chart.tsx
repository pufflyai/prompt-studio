import { HStack, Stack, Text } from "@chakra-ui/react";
import { Chart, chartColor } from "@pstdio/ui/charts";
import { colorLegend, defineChart, dot, lineY, ruleY } from "@tanstack/charts";
import { focusGroupX } from "@tanstack/charts/focus";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";

interface Point {
  time: number;
  used: number;
}
interface QuotaHistoryChartProps {
  provider: string;
  label: string;
  remainingPercent: number;
  resetsAt?: string;
  history: Point[];
  target: Point[];
  forecast: Point[];
  start: number;
  end: number;
}

export const QuotaHistoryChart = (props: QuotaHistoryChartProps) => {
  const { provider, label, remainingPercent, resetsAt, history, target, forecast, start, end } = props;
  const projected = forecast.at(-1)?.used;
  const date = (value: number) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const tick = (value: number) =>
    end - start < 86400000
      ? new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : date(value);
  const series = [
    "Usage",
    ...(forecast.length ? ["Forecast"] : []),
    ...(target.length ? ["Weekly target"] : []),
    "Quota limit",
  ];
  const colors = [
    chartColor("vis.categorical.3"),
    ...(forecast.length ? [chartColor("vis.categorical.4")] : []),
    ...(target.length ? [chartColor("vis.categorical.2")] : []),
    chartColor("vis.axis"),
  ];
  const definition = defineChart(
    {
      marks: [
        lineY(history, { x: "time", y: "used", color: () => "Usage" }),
        dot(history.slice(-1), { x: "time", y: "used", color: () => "Usage" }),
        lineY(forecast, { x: "time", y: "used", color: () => "Forecast", strokeDasharray: "5 4" }),
        lineY(target, { x: "time", y: "used", color: () => "Weekly target", strokeDasharray: "2 4" }),
        decorative(ruleY([100], { color: () => "Quota limit", strokeDasharray: "3 3" })),
      ],
      scales: {
        x: { scale: scaleLinear().domain([start, end]), axis: { ticks: { format: tick } } },
        y: {
          scale: scaleLinear().domain([0, Math.max(100, Math.ceil((projected ?? 100) / 50) * 50)]),
          grid: true,
          axis: { ticks: { format: (value: number) => `${Math.round(value)}%` } },
        },
      },
      color: { domain: series, range: colors, legend: colorLegend({ placement: "bottom" }) },
    },
    { keyboard: true, focus: focusGroupX, tooltip: { use: tooltip } },
  );
  return (
    <Stack gap="sm" minW="0">
      <HStack justify="space-between" flexWrap="wrap">
        <Text textStyle="paragraph/M/medium">{label}</Text>
        <Text textStyle="paragraph/M/medium">
          {Math.round(100 - remainingPercent)}% used · {Math.round(remainingPercent)}% remaining
        </Text>
      </HStack>
      <HStack gap="md" flexWrap="wrap" color="fg.muted" textStyle="paragraph/S/regular">
        {resetsAt && (
          <Text>
            Resets{" "}
            {new Date(resetsAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        )}
        {projected !== undefined && <Text>On pace for {Math.round(projected)}%</Text>}
      </HStack>
      <Chart
        definition={definition}
        height="3xs"
        ariaLabel={`${provider} ${label} quota history, percentage used`}
        renderTooltipBody={({ primaryPoint }) => {
          const point = primaryPoint?.datum as Point | undefined;
          return (
            point && (
              <Stack gap="xs">
                <Text>{new Date(point.time).toLocaleString()}</Text>
                <Text>
                  {primaryPoint?.groupLabel ?? "Usage"}: {Math.round(point.used)}% used
                </Text>
              </Stack>
            )
          );
        }}
      />
      {history.length === 1 && (
        <Text color="fg.muted" textStyle="paragraph/S/regular">
          History starts with this quota check.
        </Text>
      )}
    </Stack>
  );
};
