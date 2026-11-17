import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { barY, defineChart, dot, lineY, stack } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { TEST_CATEGORIES, type TestCategory } from "./test-counts";
import type { ReleaseHealth } from "./types";

const color = (value: string) => psTheme.token.var(`colors.${value}`);

export const totalTests = (run: ReleaseHealth) => run.counts.passed + run.counts.failed + run.counts.skipped;
export const quarantinedTests = (run: ReleaseHealth) => run.counts.quarantined ?? 0;
export const hasCategories = (run: ReleaseHealth) => Boolean(run.categories && Object.keys(run.categories).length);
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
const durationTick = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};
const runTime = (run: ReleaseHealth) =>
  new Date(run.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
const CATEGORY_ORDER: string[] = TEST_CATEGORIES.map((category) => category.id);
type SegmentCategory = TestCategory | "pending";
interface TestSegment {
  run: string;
  entry: ReleaseHealth;
  category: SegmentCategory;
  count: number;
}
const fillOf = (category: SegmentCategory) => (category === "pending" ? "fg.muted" : CATEGORY_COLORS[category]);

const segmentsOf = (entry: ReleaseHealth): TestSegment[] => {
  if (!hasCategories(entry)) {
    return [{ run: String(entry.id), entry, category: "pending", count: totalTests(entry) }];
  }
  return TEST_CATEGORIES.flatMap((category) => {
    const count = entry.categories?.[category.id] ?? 0;
    return count ? [{ run: String(entry.id), entry, category: category.id, count }] : [];
  });
};

const CategoryLegend = () => (
  <HStack gap="md" flexWrap="wrap">
    {TEST_CATEGORIES.map((category) => (
      <HStack key={category.id} gap="2xs">
        <Box boxSize="2" borderRadius="sm" bg={CATEGORY_COLORS[category.id]} />
        <Text textStyle="label/XS" color="fg.muted">
          {category.label}
        </Text>
      </HStack>
    ))}
  </HStack>
);

export const CategoryBreakdown = (props: { run: ReleaseHealth }) => {
  const { run } = props;
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
            {category.label} {category.value.toLocaleString()}
          </Text>
        </HStack>
      ))}
    </HStack>
  );
};

interface TotalTestsPlotProps {
  runs: ReleaseHealth[];
  onChoose: (id: number) => void;
}

// Total tests stack their categories on one shared count scale.
export const TotalTestsPlot = (props: TotalTestsPlotProps) => {
  const { runs, onChoose } = props;
  const segments = runs.flatMap(segmentsOf);
  const definition = defineChart({
    marks: [
      barY(segments, {
        x: "run",
        y: "count",
        z: "category",
        layout: stack({ order: CATEGORY_ORDER }),
        maxThickness: 64,
        fill: (item) => color(fillOf(item.category)),
        stroke: color("bg"),
        strokeWidth: 1,
      }),
    ],
    scales: {
      x: {
        scale: () =>
          scaleBand<string>()
            .domain(runs.map((run) => String(run.id)))
            .padding(0.2),
        axis: {
          ticks: {
            format: (id: string) => {
              const run = runs.find((entry) => String(entry.id) === id);
              return run ? runTime(run) : id;
            },
          },
        },
      },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (points) => {
        const run = points[0]!.datum.entry;
        const categoryRows = hasCategories(run)
          ? TEST_CATEGORIES.flatMap((category) => {
              const value = run.categories?.[category.id] ?? 0;
              return value
                ? [{ label: category.label, value: value.toLocaleString(), color: color(CATEGORY_COLORS[category.id]) }]
                : [];
            })
          : [{ label: "Tests (categorized on next refresh)", value: totalTests(run).toLocaleString() }];
        return {
          title: `${new Date(run.createdAt).toLocaleString()} · ${run.sha.slice(0, 7)}`,
          rows: [
            { label: "Total", value: totalTests(run).toLocaleString() },
            ...categoryRows,
            { label: "Failed", value: run.counts.failed.toLocaleString(), color: color("fg.error") },
            { label: "Skipped / unrun", value: run.counts.skipped.toLocaleString() },
            { label: "Verification", value: run.conclusion ?? run.status },
            { label: "Publication", value: run.published ? "Published" : "Unpublished" },
            { label: "Reported test jobs", value: `${run.reportedJobs}/${run.testJobs}` },
          ],
        };
      },
    },
  });
  return (
    <Stack gap="2xs">
      <Text textStyle="label/M/medium">Total tests</Text>
      <CategoryLegend />
      <Box color="fg.muted" textStyle="label/XS">
        <Chart
          definition={definition}
          height={220}
          ariaLabel="Total tests by release run, stacked by test category, oldest first"
          onFocusChange={(focused) => {
            if (focused) onChoose(Number(focused.datum.run));
          }}
        />
      </Box>
    </Stack>
  );
};

interface HealthPlotProps {
  runs: ReleaseHealth[];
  title: string;
  fill: string;
  value: (run: ReleaseHealth) => number;
  ariaLabel: string;
  onChoose: (id: number) => void;
}

export const HealthPlot = (props: HealthPlotProps) => {
  const { runs, title, fill, value, ariaLabel, onChoose } = props;
  const bars = runs.map((entry) => ({ run: String(entry.id), entry, count: value(entry) }));
  const definition = defineChart({
    marks: [
      barY(bars, {
        x: "run",
        y: "count",
        maxThickness: 64,
        fill: color(fill),
      }),
    ],
    scales: {
      x: {
        scale: () =>
          scaleBand<string>()
            .domain(runs.map((run) => String(run.id)))
            .padding(0.2),
        axis: {
          ticks: {
            format: (id: string) => {
              const run = runs.find((entry) => String(entry.id) === id);
              return run ? runTime(run) : id;
            },
          },
        },
      },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (points) => {
        const run = points[0]!.datum.entry;
        return {
          title: `${new Date(run.createdAt).toLocaleString()} · ${run.sha.slice(0, 7)}`,
          rows: [
            { label: "Total", value: totalTests(run).toLocaleString() },
            { label: "Passed", value: run.counts.passed.toLocaleString(), color: color("fg.success") },
            { label: "Failed", value: run.counts.failed.toLocaleString(), color: color("fg.error") },
            { label: "Quarantined", value: quarantinedTests(run).toLocaleString(), color: color("fg.warning") },
            { label: "Skipped / unrun", value: run.counts.skipped.toLocaleString() },
            { label: "Verification", value: run.conclusion ?? run.status },
            { label: "Publication", value: run.published ? "Published" : "Unpublished" },
            { label: "Reported test jobs", value: `${run.reportedJobs}/${run.testJobs}` },
          ],
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
          ariaLabel={ariaLabel}
          onFocusChange={(focused) => {
            if (focused) onChoose(Number(focused.datum.run));
          }}
        />
      </Box>
    </Stack>
  );
};

interface DurationPlotProps {
  runs: ReleaseHealth[];
  onChoose: (id: number) => void;
}

export const DurationPlot = (props: DurationPlotProps) => {
  const { runs, onChoose } = props;
  const points = runs.flatMap((entry) =>
    entry.runDurationSeconds === undefined ? [] : [{ run: String(entry.id), entry, seconds: entry.runDurationSeconds }],
  );
  const definition = defineChart({
    marks: [
      lineY(points, { x: "run", y: "seconds", stroke: color("vis.categorical.1"), strokeWidth: 2 }),
      dot(points, {
        x: "run",
        y: "seconds",
        fill: color("vis.categorical.1"),
        r: 4,
        stroke: color("bg"),
        strokeWidth: 2,
      }),
    ],
    scales: {
      x: {
        scale: () =>
          scalePoint<string>()
            .domain(runs.map((run) => String(run.id)))
            .padding(0.5),
        axis: {
          ticks: {
            format: (id: string) => {
              const run = runs.find((entry) => String(entry.id) === id);
              return run ? runTime(run) : id;
            },
          },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: { ticks: { format: (value: number) => durationTick(value) } },
      },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (points) => {
        const run = points[0]!.datum.entry;
        return {
          title: `${new Date(run.createdAt).toLocaleString()} · ${run.sha.slice(0, 7)}`,
          rows: [
            { label: "Run duration", value: formatDuration(run.runDurationSeconds ?? 0) },
            { label: "Total tests", value: totalTests(run).toLocaleString() },
            { label: "Failed", value: run.counts.failed.toLocaleString(), color: color("fg.error") },
            { label: "Quarantined", value: quarantinedTests(run).toLocaleString(), color: color("fg.warning") },
            { label: "Verification", value: run.conclusion ?? run.status },
            { label: "Reported test jobs", value: `${run.reportedJobs}/${run.testJobs}` },
          ],
        };
      },
    },
  });
  return (
    <Stack gap="2xs">
      <Text textStyle="label/M/medium">Total duration</Text>
      <Box color="fg.muted" textStyle="label/XS">
        <Chart
          definition={definition}
          height={180}
          ariaLabel="Total release run duration by run, oldest first"
          onFocusChange={(focused) => {
            if (focused) onChoose(Number(focused.datum.run));
          }}
        />
      </Box>
    </Stack>
  );
};
