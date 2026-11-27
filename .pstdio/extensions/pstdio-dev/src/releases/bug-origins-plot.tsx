import { Text } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { barY, defineChart, dot } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { Aggregation } from "../webview/period";
import { periodChartMargin, periodTitle, timelineScale } from "../webview/period-chart";
import { HealthChartFrame, HealthPlot, useHealthChartAppearance } from "./health-chart-style";
import { publicationRows, releaseMarks } from "./health-chart-timeline";
import type { HealthBucket } from "./health-timeline";
import type { BugOriginCoverage } from "./types";

const ratioFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });

interface Props {
  buckets: HealthBucket[];
  aggregation: Aggregation;
  coverage: BugOriginCoverage;
}

export const BugOriginsPlot = (props: Props) => {
  const { buckets, aggregation, coverage } = props;
  const { color: override } = useHealthChartAppearance();
  const color = override ?? psTheme.token.var("colors.red.500");
  const points = buckets.flatMap(({ date, merges }) => {
    const counts = merges?.bugOrigins;
    return counts?.features ? [{ date, ratio: counts.fixes / counts.features }] : [];
  });
  const values = scaleLinear()
    .domain([0, Math.max(1, ...points.map(({ ratio }) => ratio))])
    .nice();
  const definition = defineChart({
    margin: periodChartMargin,
    marks: [
      barY(
        points.filter(({ ratio }) => ratio > 0),
        { x: "date", y: "ratio", fill: color, maxThickness: 64 },
      ),
      dot(
        points.filter(({ ratio }) => ratio === 0),
        { x: "date", y: "ratio", fill: color, r: 2 },
      ),
      ...releaseMarks(buckets),
    ],
    scales: { x: timelineScale(buckets, aggregation), y: { scale: values, grid: true } },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (items) => {
        const bucket = buckets.find(({ date }) => date === items[0]!.xValue)!;
        const counts = bucket.merges?.bugOrigins;
        return {
          title: periodTitle(bucket.date, aggregation),
          rows: [
            ...(counts?.features
              ? [
                  { label: "Bugs per feature", value: ratioFormat.format(counts.fixes / counts.features), color },
                  { label: "Merged feature PRs", value: counts.features.toLocaleString() },
                  { label: "Attributed bug-fix PRs", value: counts.fixes.toLocaleString() },
                  { label: "Inferred links", value: counts.inferred.toLocaleString() },
                ]
              : []),
            ...publicationRows(bucket),
          ],
        };
      },
    },
  });

  return (
    <HealthChartFrame>
      {points.length ? (
        <HealthPlot definition={definition} ariaLabel={`Estimated bugs per feature by ${aggregation}, UTC`} />
      ) : (
        <Text textStyle="label/XS" color="fg.muted">
          No reviewed feature merges in this range.
        </Text>
      )}
      <Text textStyle="label/XS" color="fg.muted">
        {coverage.linkedToFeatures.toLocaleString()} of {coverage.mergedReviewed.toLocaleString()} reviewed merged bug
        PRs linked to earlier features · {coverage.linkedToOther.toLocaleString()} linked to other PRs
        {coverage.preMergeFixes ? ` · ${coverage.preMergeFixes.toLocaleString()} fixed before their origin merged` : ""}{" "}
        · {coverage.unlinked.toLocaleString()} unlinked · Reviewed through{" "}
        {dateFormat.format(new Date(coverage.reviewedThrough))}
      </Text>
    </HealthChartFrame>
  );
};
