import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, EmptyState, psTheme } from "@pstdio/ui";
import { barY, defineChart, stack } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { ChartColumn, Layers } from "lucide-react";
import { useState } from "react";
import type { Aggregation } from "../webview/period";
import { periodChartMargin, periodTitle, timelineScale } from "../webview/period-chart";
import { SelectMenu } from "../webview/select-menu";
import { seriesColorSettings, useHealthChartAppearance } from "./health-chart-style";
import { publicationRows, releaseMarks } from "./health-chart-timeline";
import type { HealthBucket } from "./health-timeline";
import { SeriesLegend } from "./series-legend";
import type { MergeThemeCoverage, PullRequestMergeBucket } from "./types";

interface MergeThemesPlotProps {
  buckets: HealthBucket[];
  aggregation: Aggregation;
  coverage?: MergeThemeCoverage;
  error?: string;
  kind?: "merges" | "bug-failures";
}

const colors = ["blue.500", "purple.500", "teal.500", "orange.500", "pink.500"];
const unclassified = { id: "unclassified", label: "Unclassified", color: "fg.subtle" };
const validation = { id: "validation", label: "Validation or delivery only", color: "pink.500" };
const labels = {
  merges: {
    title: "PR merge themes",
    selector: "Theme",
    all: "All themes",
    other: "Other themes",
    count: "Merge count",
    share: "Share of merges",
    total: "Total PRs",
  },
  "bug-failures": {
    title: "Bug failure patterns",
    selector: "Failure pattern",
    all: "All patterns",
    other: "Other patterns",
    count: "Fix count",
    share: "Share of analyzed fixes",
    total: "Analyzed bug-fix PRs",
  },
};
const percent = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });
const colorVar = (color: string) => (color.startsWith("var(") ? color : psTheme.token.var(`colors.${color}`));

const missingCount = (bucket: PullRequestMergeBucket) =>
  bucket.count - Object.values(bucket.themes ?? {}).reduce((sum, count) => sum + count, 0);

const analyzedFixes = (bucket: PullRequestMergeBucket): PullRequestMergeBucket => ({
  date: bucket.date,
  count: Object.values(bucket.bugFailures ?? {}).reduce((sum, count) => sum + count, 0),
  themes: bucket.bugFailures,
});

const themeGroups = (coverage: MergeThemeCoverage, merges: PullRequestMergeBucket[], otherLabel: string) => {
  const themes = coverage.names.map((label, index) => ({
    id: String(index),
    label,
    color: colors[index] ?? "blue.500",
  }));
  const validationIds = (coverage.validationIndices ?? []).map(String);
  const primary = themes.filter(({ id }) => !validationIds.includes(id));
  const top = primary
    .slice(0, validationIds.length ? colors.length - 1 : colors.length)
    .map((theme, index) => ({ ...theme, color: colors[index] }));
  const others = primary.slice(top.length);
  const other = { id: "other", label: otherLabel, color: "gray.500" };
  const groups = [...top];
  if (validationIds.length) groups.push(validation);
  if (others.length) groups.push(other);
  if (merges.some((bucket) => missingCount(bucket) > 0)) groups.push(unclassified);
  const options = [
    ...themes.map((theme) => {
      if (validationIds.includes(theme.id)) return { ...theme, color: validation.color };
      return top.find(({ id }) => id === theme.id) ?? theme;
    }),
    ...groups.slice(top.length),
  ];
  const countFor = (bucket: PullRequestMergeBucket, id: string) => {
    if (id === unclassified.id) return missingCount(bucket);
    if (id === other.id) {
      return others.reduce((count, theme) => count + (bucket.themes?.[Number(theme.id)] ?? 0), 0);
    }
    if (id === validation.id) {
      return validationIds.reduce((count, index) => count + (bucket.themes?.[Number(index)] ?? 0), 0);
    }
    return bucket.themes?.[Number(id)] ?? 0;
  };
  return { groups, options, countFor };
};

export const mergeThemeColors = (coverage: MergeThemeCoverage | undefined, kind: "merges" | "bug-failures") =>
  coverage &&
  seriesColorSettings(
    labels[kind].selector,
    themeGroups(coverage, [], labels[kind].other).options.concat(kind === "merges" ? [unclassified] : []),
  );

export function MergeThemesPlot({ buckets, aggregation, coverage, error, kind = "merges" }: MergeThemesPlotProps) {
  const [selection, setSelection] = useState<string>();
  const { seriesColors } = useHealthChartAppearance();
  const [measure, setMeasure] = useState("count");
  const copy = labels[kind];
  const isBugPlot = kind === "bug-failures";
  if (error) {
    return (
      <AlertMessage status="warning" title={`${copy.title} could not be loaded`}>
        {error}
      </AlertMessage>
    );
  }
  const share = measure === "share";
  const merges = buckets.flatMap(({ date, merges }) => {
    if (!merges) return [];
    if (!isBugPlot) return [merges];
    return coverage && date.slice(0, 10) <= coverage.analyzedAt.slice(0, 10) ? [analyzedFixes(merges)] : [];
  });
  if (!coverage || !merges.length || (isBugPlot && !merges.some(({ count }) => count > 0))) {
    return isBugPlot ? (
      <EmptyState title={coverage ? "No analyzed fixes in this range" : "No bug failure analysis"} />
    ) : null;
  }

  const settings = themeGroups(coverage, merges, copy.other);
  const paint = (entry: (typeof settings.groups)[number]) => ({
    ...entry,
    color: seriesColors[entry.id] ?? entry.color,
  });
  const groups = settings.groups.map(paint);
  const options = settings.options.map(paint);
  const { countFor } = settings;
  const selected = options.find(({ id }) => id === selection);
  const visible = selected ? [selected] : groups;
  const segments = merges.flatMap((bucket) =>
    visible.map(({ id, color }) => {
      const count = countFor(bucket, id);
      return { date: bucket.date, id, color, value: share && bucket.count ? count / bucket.count : count };
    }),
  );
  const values = scaleLinear()
    .domain([
      0,
      share ? 1 : Math.max(1, ...merges.map((bucket) => (selected ? countFor(bucket, selected.id) : bucket.count))),
    ])
    .nice();
  const byDate = new Map(merges.map((bucket) => [bucket.date, bucket]));
  const definition = defineChart({
    margin: periodChartMargin,
    marks: [
      barY(segments, {
        x: "date",
        y: "value",
        z: "id",
        layout: stack({ order: visible.map(({ id }) => id) }),
        fill: ({ color }) => colorVar(color),
        stroke: psTheme.token.var("colors.bg"),
        strokeWidth: 1,
        maxThickness: 64,
      }),
      ...releaseMarks(buckets),
    ],
    scales: {
      x: timelineScale(buckets, aggregation),
      y: {
        scale: values,
        grid: true,
        axis: {
          ticks: {
            values: share ? values.ticks(5) : values.ticks(5).filter(Number.isInteger),
            format: (value: number) => (share ? percent.format(value) : value.toLocaleString()),
          },
        },
      },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (points) => {
        const bucket = buckets.find(({ date }) => date === points[0]!.xValue)!;
        const merged = byDate.get(bucket.date);
        return {
          title: periodTitle(bucket.date, aggregation),
          rows: [
            ...(merged
              ? [
                  { label: copy.total, value: merged.count.toLocaleString() },
                  ...visible.map(({ id, label, color }) => {
                    const count = countFor(merged, id);
                    const portion = merged.count ? ` · ${percent.format(count / merged.count)}` : "";
                    return { label, value: `${count.toLocaleString()}${portion}`, color: colorVar(color) };
                  }),
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
      <HStack gap="2xs" flexWrap="wrap">
        <SelectMenu
          label={copy.selector}
          icon={<Layers />}
          value={selected?.id ?? "all"}
          options={[{ value: "all", label: copy.all }, ...options.map(({ id, label }) => ({ value: id, label }))]}
          onValueChange={(value) => setSelection(value === "all" ? undefined : value)}
        />
        <SelectMenu
          label="Measure"
          icon={<ChartColumn />}
          value={measure}
          options={[
            { value: "count", label: copy.count },
            { value: "share", label: copy.share },
          ]}
          onValueChange={setMeasure}
        />
      </HStack>
      <Text textStyle="label/XS" color="fg.muted">
        Analysis through {date.format(new Date(coverage.analyzedAt))} UTC
      </Text>
      <SeriesLegend label={`${copy.title} legend`} items={groups} selected={selected?.id} onSelect={setSelection} />
      <Box color="fg.muted" textStyle="label/XS">
        <Chart
          definition={definition}
          height={220}
          ariaLabel={`${selected?.label ?? copy.title} by ${aggregation}, ${share ? copy.share : copy.count}, UTC`}
        />
      </Box>
    </Stack>
  );
}
