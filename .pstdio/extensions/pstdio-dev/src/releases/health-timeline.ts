import {
  type Aggregation,
  bucketDate,
  type DateRange,
  dayOf,
  lastBucket,
  nextBucket,
  rangeStart,
} from "../webview/period";
import { addBugOriginCounts, emptyBugOriginCounts } from "./bug-origins";
import type { PullRequestMergeBucket, ReleaseHealth, ReleasePublication } from "./types";

export interface HealthBucket {
  date: string;
  merges?: PullRequestMergeBucket;
  runs: ReleaseHealth[];
  publications: ReleasePublication[];
}

interface TimelineInput {
  today: string;
  range: DateRange;
  aggregation: Aggregation;
  runs: ReleaseHealth[];
  merges: PullRequestMergeBucket[];
  /** Hourly merge buckets, used when the timeline is grouped by hour. */
  hourlyMerges?: PullRequestMergeBucket[];
  publications: ReleasePublication[];
  now?: number;
}

const mergeCounts = (bucket: HealthBucket, day: PullRequestMergeBucket) => {
  bucket.merges ??= { date: bucket.date, count: 0 };
  const counts = bucket.merges;
  counts.count += day.count;
  if (day.categories) {
    counts.categories ??= { bug: 0, feature: 0, chore: 0 };
    counts.categories.bug += day.categories.bug;
    counts.categories.feature += day.categories.feature;
    counts.categories.chore += day.categories.chore;
  }
  for (const field of ["themes", "bugFailures"] as const) {
    const source = day[field];
    if (!source) continue;
    counts[field] ??= {};
    const target = counts[field];
    for (const [key, count] of Object.entries(source)) {
      const index = Number(key);
      target[index] = (target[index] ?? 0) + count;
    }
  }
  if (day.velocity) {
    counts.velocity ??= { points: 0, estimatedFeatures: 0 };
    counts.velocity.points += day.velocity.points;
    counts.velocity.estimatedFeatures += day.velocity.estimatedFeatures;
  }
  if (day.bugOrigins) {
    counts.bugOrigins ??= emptyBugOriginCounts();
    addBugOriginCounts(counts.bugOrigins, day.bugOrigins);
  }
};

export const buildHealthTimeline = ({
  today,
  range,
  aggregation,
  runs,
  merges,
  hourlyMerges,
  publications,
  now,
}: TimelineInput) => {
  const first = rangeStart(
    today,
    range,
    [
      today,
      ...runs.map(({ createdAt }) => dayOf(createdAt)),
      ...merges.map(({ date }) => date),
      ...publications.map(({ publishedAt }) => dayOf(publishedAt)),
    ].sort()[0]!,
  );
  const inRange = (date: string) => date >= first && date <= today;
  const selectedRuns = runs.filter(({ createdAt }) => inRange(dayOf(createdAt)));
  const buckets = new Map<string, HealthBucket>();
  const last = lastBucket(today, aggregation, now);
  for (let date = bucketDate(first, aggregation); date <= last; date = nextBucket(date, aggregation)) {
    buckets.set(date, { date, runs: [], publications: [] });
  }
  // Timestamps go to their own hour when grouping by hour, and to their day otherwise.
  const bucketFor = (timestamp: string) => buckets.get(bucketDate(timestamp, aggregation));
  for (const run of selectedRuns) bucketFor(run.createdAt)?.runs.push(run);
  const mergeSeries = aggregation === "hour" ? (hourlyMerges ?? []) : merges;
  for (const entry of mergeSeries) {
    const bucket = inRange(dayOf(entry.date)) ? bucketFor(entry.date) : undefined;
    if (bucket) mergeCounts(bucket, entry);
  }
  for (const publication of publications) {
    if (inRange(dayOf(publication.publishedAt))) bucketFor(publication.publishedAt)?.publications.push(publication);
  }
  return { selectedRuns, buckets: [...buckets.values()] };
};
