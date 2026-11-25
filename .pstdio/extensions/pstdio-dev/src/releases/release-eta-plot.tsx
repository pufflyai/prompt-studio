import { Box, Stack, Text } from "@chakra-ui/react";
import { EmptyState, psTheme } from "@pstdio/ui";
import { defineChart, dot, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { periodChartMargin } from "../webview/period-chart";
import { useHealthChartAppearance } from "./health-chart-style";
import {
  AGENTIC_HOURS_PER_FAILURE,
  type EtaGrouping,
  etaSeries,
  FALLBACK_HOURS_PER_FAILURE,
  formatEtaKey,
  formatHours,
} from "./release-eta";
import { TEST_CATEGORIES } from "./test-counts";
import type { ReleaseHealth } from "./types";

const labelOf = (id: string) => TEST_CATEGORIES.find((category) => category.id === id)?.label ?? id;
const rates = TEST_CATEGORIES.filter(({ id }) => AGENTIC_HOURS_PER_FAILURE[id] > 0)
  .map(({ id, label }) => `${label} ${formatHours(AGENTIC_HOURS_PER_FAILURE[id])}`)
  .join(" · ");

export const RELEASE_ETA_DESCRIPTION = `Blocking failing tests × agentic hours to fix each (${rates}). Quarantined and performance failures don't block. Latest run per period, UTC.`;

interface ReleaseEtaPlotProps {
  runs: ReleaseHealth[];
  grouping: EtaGrouping;
  onChoose: (id: number) => void;
}

// ETA to release: failing tests that block a release × agentic hours to fix each, per category.
export const ReleaseEtaPlot = ({ runs, grouping, onChoose }: ReleaseEtaPlotProps) => {
  const appearance = useHealthChartAppearance();
  const points = etaSeries(runs, grouping);
  if (!points.length) return <EmptyState title="No release ETA in this range" />;

  const latest = points.at(-1)!.latest;
  const stroke = appearance.color ?? psTheme.token.var("colors.vis.categorical.4");
  const rows = points.map((point) => ({ key: point.key, hours: point.latest.hours, point }));
  const hours = scaleLinear()
    .domain([0, Math.max(1, ...rows.map((row) => row.hours))])
    .nice();
  const definition = defineChart({
    margin: periodChartMargin,
    marks: [
      lineY(rows, { x: "key", y: "hours", stroke, strokeWidth: 2 }),
      dot(rows, { x: "key", y: "hours", fill: stroke, r: 3 }),
    ],
    scales: {
      x: {
        scale: scaleBand<string>()
          .domain(rows.map((row) => row.key))
          .padding(0.2),
        axis: {
          ticks: { format: (key: string) => formatEtaKey(key, grouping) },
          tickLabels: { thin: { priority: "ends" as const } },
        },
      },
      y: {
        scale: hours,
        grid: true,
        axis: { ticks: { values: hours.ticks(5), format: (value: number) => formatHours(value) } },
      },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (items) => {
        const row = rows.find((entry) => entry.key === items[0]!.xValue)!;
        const eta = row.point.latest;
        return {
          title: formatEtaKey(row.key, grouping),
          rows: [
            { label: "ETA to release", value: formatHours(eta.hours), color: stroke },
            { label: "Blocking failures", value: eta.blocking.toLocaleString() },
            ...eta.breakdown.map(({ category, failed, hours: categoryHours }) => ({
              label: labelOf(category),
              value: `${failed.toLocaleString()} × ${formatHours(AGENTIC_HOURS_PER_FAILURE[category])} = ${formatHours(categoryHours)}`,
            })),
            ...(eta.estimated
              ? [{ label: "Estimate", value: `${formatHours(FALLBACK_HOURS_PER_FAILURE)} per failure (no categories)` }]
              : []),
            { label: "Run", value: `${eta.run.id} · ${eta.run.sha.slice(0, 7)}` },
            ...(row.point.runs > 1 ? [{ label: "Runs in period", value: `${row.point.runs} (latest shown)` }] : []),
          ],
        };
      },
    },
  });

  return (
    <Stack gap="2xs">
      <Text textStyle="label/M/medium">{formatHours(latest.hours)}</Text>
      <Box color="fg.muted" textStyle="label/XS">
        <Chart
          definition={definition}
          height={220}
          ariaLabel={`ETA to release by ${grouping}, UTC`}
          onFocusChange={(focused) => {
            const row = rows.find((entry) => entry.key === String(focused?.xValue));
            if (row) onChoose(row.point.latest.run.id);
          }}
        />
      </Box>
    </Stack>
  );
};
