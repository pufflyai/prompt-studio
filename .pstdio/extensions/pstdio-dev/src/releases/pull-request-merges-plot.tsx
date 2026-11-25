import { Box, Stack } from "@chakra-ui/react";
import { AlertMessage, EmptyState, psTheme } from "@pstdio/ui";
import { barY, defineChart, dot, lineY, stack } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useState } from "react";
import type { Aggregation } from "../webview/period";
import { periodChartMargin, periodTitle, timelineScale } from "../webview/period-chart";
import { seriesColorSettings, useHealthChartAppearance } from "./health-chart-style";
import { publicationRows, releaseMarks } from "./health-chart-timeline";
import type { HealthBucket } from "./health-timeline";
import { SeriesLegend } from "./series-legend";
import { PULL_REQUEST_TYPES, type PullRequestMergeBucket, type PullRequestType } from "./types";

const complexityFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const categories: Record<PullRequestType, { label: string; color: string }> = {
  bug: { label: "Bug", color: "red.500" },
  feature: { label: "Feature", color: "blue.500" },
  chore: { label: "Chore", color: "gray.500" },
};
const mergeLegend = PULL_REQUEST_TYPES.map((id) => ({ id, ...categories[id] }));
export const mergeChartColors = (categorized: boolean) =>
  categorized ? seriesColorSettings("Category", mergeLegend) : { label: "Bar color" };

type MergeType = PullRequestType | "total";
interface MergeSegment {
  date: string;
  type: MergeType;
  count: number;
}

const color = (type: MergeType) =>
  psTheme.token.var(`colors.${type === "total" ? "fg.muted" : categories[type].color}`);

const mergeSegments = (bucket: PullRequestMergeBucket, selected?: PullRequestType) => {
  if (selected) {
    return bucket.categories ? [{ date: bucket.date, type: selected, count: bucket.categories[selected] }] : [];
  }
  const segments = PULL_REQUEST_TYPES.flatMap<MergeSegment>((type) => {
    const count = bucket.categories?.[type] ?? 0;
    return count ? [{ date: bucket.date, type, count }] : [];
  });
  const unclassified = bucket.count - segments.reduce((sum, segment) => sum + segment.count, 0);
  if (unclassified > 0 || !segments.length) segments.push({ date: bucket.date, type: "total", count: unclassified });
  return segments;
};

interface TimelinePlotProps {
  buckets: HealthBucket[];
  aggregation: Aggregation;
}

export const VelocityPlot = ({ buckets, aggregation }: TimelinePlotProps) => {
  const appearance = useHealthChartAppearance();
  // Once velocity history starts, a period without merges is a real zero. Earlier periods have no velocity data.
  const start = buckets.findIndex(({ merges }) => merges?.velocity);
  const points =
    start < 0
      ? []
      : buckets.slice(start).flatMap(({ date, merges }) => {
          if (!merges) return [{ date, features: 0, points: 0, estimatedFeatures: 0 }];
          if (!merges.velocity) return [];
          return [{ date, features: merges.categories?.feature ?? 0, ...merges.velocity }];
        });
  if (!points.length) return <EmptyState title="No velocity data in this range" />;

  const stroke = appearance.color ?? color("feature");
  const values = scaleLinear()
    .domain([0, Math.max(1, ...points.map(({ points }) => points))])
    .nice();
  const definition = defineChart({
    margin: periodChartMargin,
    marks: [
      lineY(points, { x: "date", y: "points", stroke, strokeWidth: 2 }),
      dot(points, { x: "date", y: "points", fill: stroke, r: 2 }),
      ...releaseMarks(buckets),
    ],
    scales: {
      x: timelineScale(buckets, aggregation),
      y: { scale: values, grid: true, axis: { ticks: { values: values.ticks(5).filter(Number.isInteger) } } },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (items) => {
        const date = items[0]!.xValue;
        const bucket = buckets.find((entry) => entry.date === date)!;
        const point = points.find((entry) => entry.date === date);
        const average = point?.features ? complexityFormat.format(point.points / point.features) : "—";
        return {
          title: periodTitle(bucket.date, aggregation),
          rows: [
            ...(point
              ? [
                  { label: "Velocity", value: `${point.points.toLocaleString()} pts`, color: stroke },
                  { label: "Feature PRs", value: point.features.toLocaleString() },
                  { label: "Average complexity", value: average },
                  { label: "Used default complexity", value: point.estimatedFeatures.toLocaleString() },
                ]
              : []),
            ...publicationRows(bucket),
          ],
        };
      },
    },
  });

  return (
    <Stack gap="2xs">
      <Box color="fg.muted" textStyle="label/XS">
        <Chart definition={definition} height={220} ariaLabel={`Feature velocity by ${aggregation}, UTC`} />
      </Box>
    </Stack>
  );
};

export const PullRequestMergesPlot = ({ buckets, aggregation, error }: TimelinePlotProps & { error?: string }) => {
  const [selection, setSelection] = useState<PullRequestType>();
  const appearance = useHealthChartAppearance();
  const paint = (type: MergeType) =>
    appearance.seriesColors[type] ?? (type === "total" ? appearance.color : undefined) ?? color(type);
  const merges = buckets.flatMap(({ merges }) => (merges ? [merges] : []));
  const warning = error ? (
    <AlertMessage status="warning" title="PR merges could not be refreshed">
      {merges.length ? `Showing cached counts. ${error}` : error}
    </AlertMessage>
  ) : null;
  if (!merges.length) return warning ?? <EmptyState title="No PR merge data in this range" />;

  const categorized = merges.some((bucket) => bucket.categories);
  const selected = categorized ? selection : undefined;
  const visibleTypes = selected ? [selected] : PULL_REQUEST_TYPES;
  const counts = scaleLinear()
    .domain([
      0,
      Math.max(1, ...merges.map((bucket) => (selected ? (bucket.categories?.[selected] ?? 0) : bucket.count))),
    ])
    .nice();
  const definition = defineChart({
    margin: periodChartMargin,
    marks: [
      barY(
        merges.flatMap((bucket) => mergeSegments(bucket, selected)),
        {
          x: "date",
          y: "count",
          z: "type",
          layout: stack({ order: [...PULL_REQUEST_TYPES, "total"] }),
          fill: ({ type }) => paint(type),
          stroke: psTheme.token.var("colors.bg"),
          strokeWidth: 1,
          maxThickness: 64,
        },
      ),
      ...releaseMarks(buckets),
    ],
    scales: {
      x: timelineScale(buckets, aggregation),
      y: { scale: counts, grid: true, axis: { ticks: { values: counts.ticks(5).filter(Number.isInteger) } } },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (points) => {
        const bucket = buckets.find((entry) => entry.date === points[0]!.xValue)!;
        const merged = bucket.merges;
        const breakdown = merged?.categories;
        return {
          title: periodTitle(bucket.date, aggregation),
          rows: [
            ...(merged && !selected ? [{ label: "Total PRs", value: merged.count.toLocaleString() }] : []),
            ...(breakdown
              ? visibleTypes.map((type) => ({
                  label: categories[type].label,
                  value: breakdown[type].toLocaleString(),
                  color: paint(type),
                }))
              : []),
            ...publicationRows(bucket),
          ],
        };
      },
    },
  });

  return (
    <Stack gap="lg">
      {warning}
      <Stack gap="2xs">
        {categorized ? (
          <SeriesLegend
            label="PR category legend"
            items={mergeLegend.map((item) => ({ ...item, color: paint(item.id) }))}
            selected={selected}
            onSelect={setSelection}
          />
        ) : null}
        <Box color="fg.muted" textStyle="label/XS">
          <Chart
            definition={definition}
            height={220}
            ariaLabel={
              selected
                ? `${categories[selected].label} PR merges by ${aggregation}, UTC`
                : `PR merges by ${aggregation}, UTC`
            }
          />
        </Box>
      </Stack>
    </Stack>
  );
};
