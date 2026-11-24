import { EmptyState } from "@pstdio/ui";
import {
  type DashboardDataSource,
  type DashboardDefinition,
  DashboardRenderer,
  type DashboardRendererProps,
} from "@pstdio/ui/dashboard-renderer";
import { useState } from "react";
import type { Aggregation } from "../webview/period";
import { BugOriginsPlot } from "./bug-origins-plot";
import { bucketMetrics, RunMetricPlot, TotalTestsPlot } from "./health-charts";
import { HealthRuns, runVerification } from "./health-runs";
import type { HealthBucket } from "./health-timeline";
import { PullRequestMergesPlot, VelocityPlot } from "./pull-request-merges-plot";
import { ReleaseEtaPlot } from "./release-eta-plot";
import type { BugOriginCoverage, ReleaseHealth } from "./types";

const initialDashboard: DashboardDefinition = {
  mode: "vertical",
  widgets: [
    { id: "eta", title: "", kind: "custom", source: "eta", layout: { x: 0, y: 0, w: 12, h: 7 } },
    { id: "merges", title: "", kind: "custom", source: "merges", layout: { x: 0, y: 7, w: 12, h: 7 } },
    { id: "velocity", title: "", kind: "custom", source: "velocity", layout: { x: 0, y: 14, w: 12, h: 7 } },
    { id: "bug-origins", title: "", kind: "custom", source: "bug-origins", layout: { x: 0, y: 21, w: 12, h: 8 } },
    { id: "tests", title: "", kind: "custom", source: "tests", layout: { x: 0, y: 29, w: 12, h: 7 } },
    { id: "failed", title: "", kind: "custom", source: "failed", layout: { x: 0, y: 36, w: 12, h: 6 } },
    { id: "quarantined", title: "", kind: "custom", source: "quarantined", layout: { x: 0, y: 42, w: 12, h: 6 } },
    { id: "duration", title: "", kind: "custom", source: "duration", layout: { x: 0, y: 48, w: 12, h: 6 } },
    { id: "runs", title: "", kind: "custom", source: "runs", layout: { x: 0, y: 54, w: 12, h: 15 } },
  ],
};

interface HealthDashboardProps {
  buckets: HealthBucket[];
  runs: ReleaseHealth[];
  aggregation: Aggregation;
  bugOriginCoverage?: BugOriginCoverage;
  pullRequestMergesError?: string;
  chosen?: number;
  onChoose: (id: number) => void;
  onOpen: (url: string) => void;
  renderToolbar: NonNullable<DashboardRendererProps["renderToolbar"]>;
}

export function HealthDashboard(props: HealthDashboardProps) {
  const {
    buckets,
    runs,
    aggregation,
    bugOriginCoverage,
    pullRequestMergesError,
    chosen,
    onChoose,
    onOpen,
    renderToolbar,
  } = props;
  const [value, setValue] = useState(initialDashboard);
  const runPlotProps = { buckets: buckets.map(bucketMetrics), aggregation, onChoose };
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
      id: "eta",
      name: "ETA to release",
      content: <ReleaseEtaPlot runs={runs} grouping={aggregation} onChoose={onChoose} />,
    },
    {
      id: "merges",
      name: "PR merges",
      content: <PullRequestMergesPlot buckets={buckets} aggregation={aggregation} error={pullRequestMergesError} />,
    },
    {
      id: "velocity",
      name: "Velocity",
      content: <VelocityPlot buckets={buckets} aggregation={aggregation} />,
    },
    {
      id: "bug-origins",
      name: "Estimated bugs per feature",
      content: bugOriginCoverage ? (
        <BugOriginsPlot buckets={buckets} aggregation={aggregation} coverage={bugOriginCoverage} />
      ) : (
        <EmptyState title="No bug attribution data" />
      ),
    },
    { id: "tests", name: "Total tests", content: <TotalTestsPlot {...runPlotProps} /> },
    { id: "failed", name: "Failed tests", content: <RunMetricPlot {...runPlotProps} metric="failed" /> },
    {
      id: "quarantined",
      name: "Quarantined tests",
      content: <RunMetricPlot {...runPlotProps} metric="quarantined" />,
    },
    {
      id: "duration",
      name: "Average run duration",
      content: <RunMetricPlot {...runPlotProps} metric="duration" />,
    },
    {
      id: "runs",
      name: "Release runs",
      content: <HealthRuns runs={runs} chosen={chosen} onChoose={onChoose} onOpen={onOpen} />,
    },
    {
      id: "run-analysis",
      name: "Release run analysis",
      scatter: { xLabel: "Duration (min)", yLabel: "Failed tests", points: observations },
      series: observations.map(({ group }) => ({ label: group, value: 1 })),
    },
  ];
  return <DashboardRenderer value={value} sources={sources} onChange={setValue} renderToolbar={renderToolbar} />;
}
