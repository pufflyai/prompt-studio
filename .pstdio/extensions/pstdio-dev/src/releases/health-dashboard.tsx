import { Box } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import {
  type DashboardDataSource,
  type DashboardDefinition,
  DashboardRenderer,
  type DashboardRendererProps,
  type DashboardSeriesPoint,
} from "@pstdio/ui/dashboard-renderer";
import { useState } from "react";
import type { Aggregation } from "../webview/period";
import { BugOriginsPlot } from "./bug-origins-plot";
import { healthChart, releaseHealthDashboardLayout } from "./health-chart-style";
import { bucketMetrics, formatDuration, RunMetricPlot, TotalTestsPlot, testChartColors } from "./health-charts";
import { HealthRuns, runVerification } from "./health-runs";
import type { HealthBucket } from "./health-timeline";
import { MergeThemesPlot, mergeThemeColors } from "./merge-themes-plot";
import { mergeChartColors, PullRequestMergesPlot, VelocityPlot } from "./pull-request-merges-plot";
import { etaSeries, formatHours } from "./release-eta";
import { RELEASE_ETA_DESCRIPTION, ReleaseEtaPlot } from "./release-eta-plot";
import type { BugOriginCoverage, MergeThemeCoverage, ReleaseHealth } from "./types";

const chartText = {
  eta: { title: "ETA to release", description: RELEASE_ETA_DESCRIPTION },
  merges: { title: "PR merges" },
  "merge-themes": { title: "PR merge themes" },
  "bug-failure-patterns": { title: "Bug failure patterns", description: "Patterns inferred from fixes" },
  velocity: { title: "Velocity", description: "Merged feature PRs × average complexity" },
  "bug-origins": {
    title: "Estimated bugs per feature",
    description: "Merged bug-fix PRs attributed to features, grouped by feature merge date",
  },
  tests: { title: "Total tests" },
  failed: { title: "Failed tests" },
  quarantined: { title: "Quarantined tests" },
  duration: { title: "Average run duration" },
  runs: { title: "Release runs" },
};

const chartSource = (id: keyof typeof chartText) => ({
  id,
  name: chartText[id].title,
  customWidgetDefaults: chartText[id],
});

const chartWidget = (source: keyof typeof chartText, y: number, h: number) => ({
  id: source,
  ...chartText[source],
  kind: "custom" as const,
  source,
  layout: { x: 0, y, w: 12, h },
});

const initialDashboard: DashboardDefinition = {
  mode: "vertical",
  widgets: [
    chartWidget("eta", 0, 7),
    chartWidget("merges", 7, 7),
    chartWidget("merge-themes", 14, 8),
    chartWidget("bug-failure-patterns", 22, 9),
    chartWidget("velocity", 31, 7),
    chartWidget("bug-origins", 38, 8),
    chartWidget("tests", 46, 7),
    chartWidget("failed", 53, 6),
    chartWidget("quarantined", 59, 6),
    chartWidget("duration", 65, 6),
    chartWidget("runs", 71, 15),
  ],
};

interface HealthDashboardProps {
  buckets: HealthBucket[];
  runs: ReleaseHealth[];
  aggregation: Aggregation;
  hasRunHistory: boolean;
  runEmptyTitle: string;
  bugOriginCoverage?: BugOriginCoverage;
  pullRequestMergesError?: string;
  mergeThemes?: MergeThemeCoverage;
  mergeThemesError?: string;
  bugFailurePatterns?: MergeThemeCoverage;
  bugFailurePatternsError?: string;
  chosen?: number;
  onChoose: (id: number) => void;
  onOpen: (url: string) => void;
  renderToolbar: NonNullable<DashboardRendererProps["renderToolbar"]>;
}

const formatTotal = (series: DashboardSeriesPoint[]) =>
  series.length ? series.reduce((total, { value }) => total + value, 0).toLocaleString() : "—";

export function HealthDashboard(props: HealthDashboardProps) {
  const {
    buckets,
    runs,
    aggregation,
    hasRunHistory,
    runEmptyTitle,
    bugOriginCoverage,
    pullRequestMergesError,
    mergeThemes,
    mergeThemesError,
    bugFailurePatterns,
    bugFailurePatternsError,
    chosen,
    onChoose,
    onOpen,
    renderToolbar,
  } = props;
  const [value, setValue] = useState(initialDashboard);
  const runPlotProps = { buckets: buckets.map(bucketMetrics), aggregation, onChoose };
  const eta = etaSeries(runs, aggregation);
  const latestEta = eta.at(-1)?.latest;
  const merges = buckets.flatMap(({ date, merges }) => (merges ? [{ label: date, value: merges.count }] : []));
  const failures = runPlotProps.buckets.flatMap(({ date, measured, failed }) =>
    measured.length ? [{ label: date, value: failed }] : [],
  );
  const timed = runPlotProps.buckets.flatMap(({ date, duration }) =>
    duration === undefined ? [] : [{ label: date, duration }],
  );
  const latestDuration = timed.at(-1)?.duration;
  const observations = runs.flatMap((run) =>
    run.runDurationSeconds === undefined || !run.counts.reports
      ? []
      : [
          {
            x: run.runDurationSeconds / 60,
            y: run.counts.failed,
            label: `Run ${run.id} · ${run.sha.slice(0, 7)}`,
            group: runVerification(run),
          },
        ],
  );
  const sources: DashboardDataSource[] = [
    {
      id: "run-analysis",
      name: "Release run analysis",
      scatter: { xLabel: "Duration (min)", yLabel: "Failed tests", points: observations },
      series: observations.map(({ group }) => ({ label: group, value: 1 })),
    },
    {
      ...chartSource("eta"),
      metric: {
        value: latestEta ? formatHours(latestEta.hours) : "—",
        description: "Latest run with complete evidence",
      },
      series: eta.map(({ key, latest }) => ({ label: key, value: latest.hours })),
      colorSettings: { label: "Line color" },
      content: healthChart(<ReleaseEtaPlot runs={runs} grouping={aggregation} onChoose={onChoose} />),
    },
    {
      ...chartSource("merges"),
      metric: { value: formatTotal(merges), description: "Selected range" },
      series: merges,
      colorSettings: mergeChartColors(buckets.some(({ merges }) => merges?.categories)),
      content: healthChart(
        <PullRequestMergesPlot buckets={buckets} aggregation={aggregation} error={pullRequestMergesError} />,
      ),
    },
    {
      ...chartSource("merge-themes"),
      colorSettings: mergeThemeColors(mergeThemes, "merges"),
      content: healthChart(
        <MergeThemesPlot buckets={buckets} aggregation={aggregation} coverage={mergeThemes} error={mergeThemesError} />,
      ),
    },
    {
      ...chartSource("bug-failure-patterns"),
      colorSettings: mergeThemeColors(bugFailurePatterns, "bug-failures"),
      content: healthChart(
        <MergeThemesPlot
          kind="bug-failures"
          buckets={buckets}
          aggregation={aggregation}
          coverage={bugFailurePatterns}
          error={bugFailurePatternsError}
        />,
      ),
    },
    {
      ...chartSource("velocity"),
      colorSettings: { label: "Line color" },
      content: healthChart(<VelocityPlot buckets={buckets} aggregation={aggregation} />),
    },
    {
      ...chartSource("bug-origins"),
      colorSettings: { label: "Bar color" },
      content: healthChart(
        bugOriginCoverage ? (
          <BugOriginsPlot buckets={buckets} aggregation={aggregation} coverage={bugOriginCoverage} />
        ) : (
          <EmptyState title="No bug attribution data" />
        ),
      ),
    },
    {
      ...chartSource("tests"),
      colorSettings: testChartColors,
      content: healthChart(<TotalTestsPlot {...runPlotProps} />),
    },
    {
      ...chartSource("failed"),
      metric: { value: formatTotal(failures), description: "Selected range" },
      series: failures,
      colorSettings: { label: "Bar color" },
      content: healthChart(<RunMetricPlot {...runPlotProps} metric="failed" />),
    },
    {
      ...chartSource("quarantined"),
      colorSettings: { label: "Bar color" },
      content: healthChart(<RunMetricPlot {...runPlotProps} metric="quarantined" />),
    },
    {
      ...chartSource("duration"),
      metric: {
        value: latestDuration === undefined ? "—" : formatDuration(latestDuration),
        description: "Latest period with timed runs",
      },
      series: timed.map(({ label, duration }) => ({ label, value: duration / 60 })),
      colorSettings: { label: "Line color" },
      content: healthChart(<RunMetricPlot {...runPlotProps} metric="duration" />),
    },
    {
      ...chartSource("runs"),
      metric: { value: hasRunHistory ? runs.length.toLocaleString() : "—", description: "Selected range" },
      series: hasRunHistory ? buckets.map(({ date, runs }) => ({ label: date, value: runs.length })) : [],
      content: healthChart(
        <HealthRuns runs={runs} emptyTitle={runEmptyTitle} chosen={chosen} onChoose={onChoose} onOpen={onOpen} />,
      ),
    },
  ];
  return (
    <Box h="full" minH="0" css={releaseHealthDashboardLayout}>
      <DashboardRenderer value={value} sources={sources} onChange={setValue} renderToolbar={renderToolbar} />
    </Box>
  );
}
