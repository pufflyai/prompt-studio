import type { Launch } from "../diagnostics/timeline";
import { type Aggregation, bucketDate, type DateRange, dayOf, nextBucket, rangeStart } from "../webview/period";

export interface StartupBucket {
  date: string;
  launches: Launch[];
}

interface StartupTimelineInput {
  today: string;
  range: DateRange;
  aggregation: Aggregation;
  launches: Launch[];
}

export const slowestSetup = (launch: Launch) => {
  const durations = launch.setups.flatMap(({ durationMs }) => (durationMs === null ? [] : [durationMs]));
  return durations.length ? Math.max(...durations) : null;
};

export const buildStartupTimeline = ({ today, range, aggregation, launches }: StartupTimelineInput) => {
  const first = rangeStart(today, range, [today, ...launches.map(({ startedAt }) => dayOf(startedAt))].sort()[0]!);
  const inRange = (date: string) => date >= first && date <= today;
  const selectedLaunches = launches.filter(({ startedAt }) => inRange(dayOf(startedAt)));
  const buckets = new Map<string, StartupBucket>();
  for (let date = bucketDate(first, aggregation); date <= today; date = nextBucket(date, aggregation)) {
    buckets.set(date, { date, launches: [] });
  }
  for (const launch of selectedLaunches) {
    buckets.get(bucketDate(dayOf(launch.startedAt), aggregation))?.launches.push(launch);
  }
  return { selectedLaunches, buckets: [...buckets.values()] };
};

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Averages ignore launches that never became ready or whose setups are still running. */
export const startupBucketMetrics = (bucket: StartupBucket) => {
  const ready = bucket.launches.flatMap(({ readyMs }) => (readyMs === null ? [] : [readyMs]));
  const setups = bucket.launches.flatMap((launch) => {
    const slowest = slowestSetup(launch);
    return slowest === null ? [] : [slowest];
  });
  return {
    ...bucket,
    ready: ready.length ? average(ready) : null,
    slowestReady: ready.length ? Math.max(...ready) : null,
    setup: setups.length ? average(setups) : null,
  };
};
