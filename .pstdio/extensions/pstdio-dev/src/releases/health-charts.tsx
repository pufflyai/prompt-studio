import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { barY, defineChart, dot, lineY, stack } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useState } from "react";
import type { Aggregation } from "../webview/period";
import { periodChartMargin, periodTitle, timelineScale } from "../webview/period-chart";
import { publicationRows, releaseMarks } from "./health-chart-timeline";
import type { HealthBucket } from "./health-timeline";
import { SeriesLegend } from "./series-legend";
import { TEST_CATEGORIES, type TestCategory } from "./test-counts";
import type { ReleaseHealth } from "./types";

const color = (value: string) => psTheme.token.var(`colors.${value}`);
const formatCount = (value: number) => value.toLocaleString();

export const formatDuration = (seconds: number) => {
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
};

// Alternate light and dark blue shades so neighbouring stacks stay visibly separate.
const CATEGORY_COLORS: Record<TestCategory, string> = {
  "end-to-end": "vis.sequential.blue.low-2",
  components: "vis.sequential.blue.high-1",
  backend: "vis.sequential.blue.low-3",
  packages: "vis.sequential.blue.default",
  harness: "vis.sequential.blue.high-3",
  performance: "vis.sequential.blue.low-1",
  quarantine: "vis.sequential.blue.high-2",
};
const categories = [...TEST_CATEGORIES, { id: "pending" as const, label: "Uncategorized" }];
type TestSeries = (typeof categories)[number]["id"];
const categoryColor = (category: TestSeries) => (category === "pending" ? "fg.muted" : CATEGORY_COLORS[category]);
const categoryLegend = categories.map(({ id, label }) => ({ id, label, color: categoryColor(id) }));

export const CategoryBreakdown = ({ run }: { run: ReleaseHealth }) => {
  const measured = TEST_CATEGORIES.flatMap((category) => {
    const value = run.categories?.[category.id];
    return value ? [{ ...category, value }] : [];
  });
  if (!measured.length) return null;
  return (
    <HStack gap="sm" flexWrap="wrap">
      {measured.map((category) => (
        <HStack key={category.id} gap="2xs">
          <Box boxSize="2" borderRadius="sm" bg={CATEGORY_COLORS[category.id]} />
          <Text textStyle="label/XS" color="fg.muted">
            {category.label} {formatCount(category.value)}
          </Text>
        </HStack>
      ))}
    </HStack>
  );
};

const bucketMetrics = (bucket: HealthBucket) => {
  const measured = bucket.runs.filter(({ counts }) => counts.reports > 0);
  const timed = bucket.runs.filter(({ runDurationSeconds }) => runDurationSeconds !== undefined);
  const passed = measured.reduce((sum, run) => sum + run.counts.passed, 0);
  const failed = measured.reduce((sum, run) => sum + run.counts.failed, 0);
  const skipped = measured.reduce((sum, run) => sum + run.counts.skipped, 0);
  const quarantined = measured.reduce((sum, run) => sum + (run.counts.quarantined ?? 0), 0);
  const total = passed + failed + skipped;
  const segments = TEST_CATEGORIES.flatMap((category) => {
    const count = measured.reduce((sum, run) => sum + (run.categories?.[category.id] ?? 0), 0);
    return count ? [{ date: bucket.date, category: category.id, count }] : [];
  });
  const pending = total - segments.reduce((sum, segment) => sum + segment.count, 0);
  const duration = timed.length
    ? timed.reduce((sum, run) => sum + run.runDurationSeconds!, 0) / timed.length
    : undefined;
  return {
    ...bucket,
    measured,
    timed,
    total,
    passed,
    failed,
    skipped,
    quarantined,
    duration,
    segments:
      pending > 0 ? [...segments, { date: bucket.date, category: "pending" as const, count: pending }] : segments,
  };
};

type RunBucket = ReturnType<typeof bucketMetrics>;
interface RunPlotProps {
  buckets: RunBucket[];
  aggregation: Aggregation;
  onChoose: (id: number) => void;
}

const testRows = (bucket: RunBucket) => [
  { label: "Test runs with reports", value: `${bucket.measured.length}/${bucket.runs.length}` },
  { label: "Total", value: formatCount(bucket.total) },
  { label: "Passed", value: formatCount(bucket.passed), color: color("fg.success") },
  { label: "Failed", value: formatCount(bucket.failed), color: color("fg.error") },
  { label: "Quarantined", value: formatCount(bucket.quarantined), color: color("fg.warning") },
  { label: "Skipped / unrun", value: formatCount(bucket.skipped) },
];

const testSegments = (bucket: RunBucket, selected?: TestSeries) => {
  if (!selected) return bucket.segments;
  if (!bucket.measured.length) return [];
  const count = bucket.segments.find(({ category }) => category === selected)?.count ?? 0;
  return [{ date: bucket.date, category: selected, count }];
};

const TotalTestsPlot = ({ buckets, aggregation, onChoose }: RunPlotProps) => {
  const [selection, setSelection] = useState<TestSeries>();
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  const uncategorized = buckets.some(({ segments }) => segments.some(({ category }) => category === "pending"));
  const legend = uncategorized ? categoryLegend : categoryLegend.filter(({ id }) => id !== "pending");
  const selected = legend.find(({ id }) => id === selection);
  const segments = buckets.flatMap((bucket) => testSegments(bucket, selected?.id));
  const definition = defineChart({
    margin: periodChartMargin,
    marks: [
      barY(segments, {
        x: "date",
        y: "count",
        z: "category",
        layout: stack({ order: categories.map(({ id }) => id) }),
        maxThickness: 64,
        fill: ({ category }) => color(categoryColor(category)),
        stroke: color("bg"),
        strokeWidth: 1,
      }),
      ...releaseMarks(buckets),
    ],
    scales: { x: timelineScale(buckets, aggregation), y: { scale: scaleLinear, nice: true, grid: true } },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (points) => {
        const bucket = byDate.get(String(points[0]!.xValue))!;
        return {
          title: periodTitle(bucket.date, aggregation),
          rows: [
            ...(bucket.measured.length
              ? [
                  ...(selected ? [] : testRows(bucket)),
                  ...testSegments(bucket, selected?.id).map(({ category, count }) => ({
                    label: categories.find(({ id }) => id === category)!.label,
                    value: formatCount(count),
                    color: color(categoryColor(category)),
                  })),
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
      <Text textStyle="label/M/medium">Total tests</Text>
      <SeriesLegend label="Test category legend" items={legend} selected={selected?.id} onSelect={setSelection} />
      <Box color="fg.muted" textStyle="label/XS">
        <Chart
          definition={definition}
          height={220}
          ariaLabel={
            selected
              ? `${selected.label} test executions by ${aggregation}, UTC`
              : `Total test executions by ${aggregation}, UTC`
          }
          onFocusChange={(focused) => {
            const run = byDate.get(String(focused?.xValue))?.measured.at(-1);
            if (run) onChoose(run.id);
          }}
        />
      </Box>
    </Stack>
  );
};

const metricConfig = {
  failed: { title: "Failed tests", fill: "fg.error" },
  quarantined: { title: "Quarantined tests", fill: "fg.warning" },
  duration: { title: "Average run duration", fill: "vis.categorical.1" },
} as const;

const RunMetricPlot = ({
  buckets,
  aggregation,
  onChoose,
  metric,
}: RunPlotProps & { metric: keyof typeof metricConfig }) => {
  const { title, fill } = metricConfig[metric];
  const duration = metric === "duration";
  const points = buckets.flatMap((bucket) => {
    const value = bucket[metric];
    if (value === undefined || (!duration && !bucket.measured.length)) return [];
    return [{ date: bucket.date, value }];
  });
  if (!points.length) return null;
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  const marks = duration
    ? [
        lineY(points, { x: "date", y: "value", stroke: color(fill), strokeWidth: 2 }),
        dot(points, { x: "date", y: "value", fill: color(fill), r: 3 }),
      ]
    : [barY(points, { x: "date", y: "value", fill: color(fill), maxThickness: 64 })];
  const definition = defineChart({
    margin: periodChartMargin,
    marks: [...marks, ...releaseMarks(buckets)],
    scales: {
      x: timelineScale(buckets, aggregation),
      y: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: duration ? { ticks: { format: formatDuration } } : undefined,
      },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (items) => {
        const bucket = byDate.get(String(items[0]!.xValue))!;
        const durationRows =
          bucket.duration === undefined
            ? []
            : [
                { label: "Average duration", value: formatDuration(bucket.duration) },
                { label: "Runs timed", value: formatCount(bucket.timed.length) },
              ];
        const evidenceRows = bucket.measured.length ? testRows(bucket) : [];
        return {
          title: periodTitle(bucket.date, aggregation),
          rows: [...(duration ? durationRows : evidenceRows), ...publicationRows(bucket)],
        };
      },
    },
  });
  return (
    <Stack gap="2xs">
      <Text textStyle="label/M/medium">{title}</Text>
      <Box color="fg.muted" textStyle="label/XS">
        <Chart
          definition={definition}
          height={180}
          ariaLabel={`${title} by ${aggregation}, UTC`}
          onFocusChange={(focused) => {
            const bucket = byDate.get(String(focused?.xValue));
            const run = (duration ? bucket?.timed : bucket?.measured)?.at(-1);
            if (run) onChoose(run.id);
          }}
        />
      </Box>
    </Stack>
  );
};

export const ReleaseRunPlots = ({
  buckets,
  aggregation,
  onChoose,
}: {
  buckets: HealthBucket[];
  aggregation: Aggregation;
  onChoose: (id: number) => void;
}) => {
  const metrics = buckets.map(bucketMetrics);
  const measured = metrics.some((bucket) => bucket.measured.length);
  return (
    <>
      {measured ? <TotalTestsPlot buckets={metrics} aggregation={aggregation} onChoose={onChoose} /> : null}
      <RunMetricPlot buckets={metrics} aggregation={aggregation} onChoose={onChoose} metric="failed" />
      <RunMetricPlot buckets={metrics} aggregation={aggregation} onChoose={onChoose} metric="quarantined" />
      <RunMetricPlot buckets={metrics} aggregation={aggregation} onChoose={onChoose} metric="duration" />
    </>
  );
};
