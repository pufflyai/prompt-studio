import { HStack, Stack, Text } from "@chakra-ui/react";
import { Chart, chartColor } from "@pstdio/ui/charts";
import { colorLegend, defineChart, dot, lineY, ruleY } from "@tanstack/charts";
import { focusGroupX } from "@tanstack/charts/focus";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { ReactNode } from "react";

interface Point {
  time: number;
  used: number;
}
interface QuotaHistoryChartProps {
  provider: string;
  label: string;
  header?: ReactNode;
  resetsAt?: string;
  history: Point[];
  forecast: Point[];
  start: number;
  end: number;
}

export const QuotaHistoryChart = (props: QuotaHistoryChartProps) => {
  const { provider, label, header, resetsAt, history, forecast, start, end } = props;
  const projected = forecast.at(-1)?.used;
  const date = (value: number) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const tick = (value: number) =>
    end - start < 86400000
      ? new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : date(value);
  const series = ["Usage", "Forecast", "Limit"];
  const colors = [chartColor("vis.categorical.3"), chartColor("vis.alert.warning"), chartColor("vis.axis")];
  const definition = defineChart(
    {
      marks: [
        lineY(history, { x: "time", y: "used", color: () => "Usage" }),
        dot(history.slice(-1), { x: "time", y: "used", color: () => "Usage" }),
        lineY(forecast, { x: "time", y: "used", color: () => "Forecast" }),
        decorative(ruleY([100], { color: () => "Limit" })),
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
      {header}
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
    </Stack>
  );
};
