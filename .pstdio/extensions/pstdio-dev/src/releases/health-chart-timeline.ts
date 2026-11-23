import { psTheme } from "@pstdio/ui";
import { dot, ruleX } from "@tanstack/charts";
import type { HealthBucket } from "./health-timeline";

const publicationTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export const releaseMarks = (buckets: HealthBucket[]) => {
  const dates = buckets.filter(({ publications }) => publications.length).map(({ date }) => date);
  return [
    ruleX(dates, {
      stroke: psTheme.token.var("colors.fg.muted"),
      strokeDasharray: "4 4",
      strokeOpacity: 0.8,
      strokeWidth: 1,
    }),
    // The rule has no y coordinate. Give release-only periods a point for tooltip and keyboard focus.
    dot(dates, { x: (date) => date, y: () => 0, r: 0, fill: "transparent" }),
  ] as const;
};

export const publicationRows = (bucket: HealthBucket) =>
  bucket.publications.map(({ tag, publishedAt }) => ({
    label: tag,
    value: `${publicationTime.format(new Date(publishedAt))} UTC`,
  }));
