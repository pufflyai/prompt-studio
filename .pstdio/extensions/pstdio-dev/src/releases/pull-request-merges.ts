import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { ghJson } from "../benchmarks/github";
import {
  addBugOriginCounts,
  BUG_ORIGIN_AUDIT,
  type BugOriginAudit,
  emptyBugOriginCounts,
  summarizeBugOrigins,
} from "./bug-origins";
import { DEFAULT_COMPLEXITY, type FeatureComplexity, readFeatureComplexity } from "./feature-complexity";
import { type MergeAssignments, readMergeAnalysis } from "./merge-themes";
import type { PullRequestMergeBucket, PullRequestType } from "./types";

type Context = Pick<ExtensionContextBase, "process">;
type ExtensionFiles = NonNullable<ExtensionContextBase["extensionFiles"]>;
type MergeBucket = PullRequestMergeBucket & Required<Pick<PullRequestMergeBucket, "categories" | "velocity">>;
const TIMELINE = "releases/pull-request-timeline.json";
const CLASSIFICATIONS = "releases/pull-request-classifications.json";
const LEGACY_AREAS = "releases/pull-request-areas.json";
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const RATING_REFRESH_MS = 30 * DAY_MS;

interface MergedPull {
  number: number;
  title: string;
  mergedAt: string;
  updatedAt: string;
}

interface PullResponse {
  data: {
    repository: {
      nameWithOwner: string;
      pullRequests: {
        nodes: MergedPull[];
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
      };
    };
  };
}

interface Timeline {
  repository?: string;
  refreshedAt?: string;
  pulls?: MergedPull[];
  featureComplexity?: FeatureComplexity;
  error?: string;
}

interface Classifications {
  repository: string;
  categories: Record<string, PullRequestType>;
}

const readJson = async <T>(files: ExtensionFiles, path: string) =>
  (await files.exists(path)) ? (JSON.parse(await files.readText(path)) as T) : undefined;

const pullPage = async (ctx: Context, cursor: string | null) => {
  const { data } = await ghJson<PullResponse>(ctx, [
    "api",
    "graphql",
    "-F",
    "owner={owner}",
    "-F",
    "name={repo}",
    "-f",
    `query=query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        nameWithOwner
        pullRequests(first: 100, after: ${JSON.stringify(cursor)}, states: MERGED,
          orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes { number title mergedAt updatedAt }
          pageInfo { endCursor hasNextPage }
        }
      }
    }`,
  ]);
  return data.repository;
};

const collectMergedPulls = async (ctx: Context, previous: Timeline) => {
  const refreshedAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
  const first = await pullPage(ctx, null);
  const repository = first.nameWithOwner;
  const saved = previous.repository === repository ? previous : {};
  const since = saved.refreshedAt ? Date.parse(saved.refreshedAt) : -Infinity;
  const pulls = new Map(saved.pulls?.map((pull) => [pull.number, pull]));

  let page = first.pullRequests;
  while (true) {
    for (const pull of page.nodes) pulls.set(pull.number, pull);
    const { hasNextPage, endCursor } = page.pageInfo;
    // A newly merged PR has an update at or after the merge. Keep the last refresh's starting second in scope.
    if (!hasNextPage || page.nodes.some((pull) => Date.parse(pull.updatedAt) < since)) break;
    if (!endCursor) throw new Error("GitHub returned an incomplete merge history.");
    page = (await pullPage(ctx, endCursor)).pullRequests;
  }
  return { repository, refreshedAt, pulls: [...pulls.values()], featureComplexity: saved.featureComplexity };
};

const titleCategory = (title: string) => {
  const convention = title
    .match(
      /^(fix|bug|bugfix|hotfix|feat|feature|chore|refactor|docs|test|build|ci|style|perf|deps|revert)(?:\([^)]*\))?!?:\s/i,
    )?.[1]
    ?.toLowerCase();
  if (convention) {
    if (["fix", "bug", "bugfix", "hotfix"].includes(convention)) return "bug";
    if (["feat", "feature"].includes(convention)) return "feature";
    return "chore";
  }
  if (/^(?:fix|repair|correct|restore|resolve|prevent)\b/i.test(title)) return "bug";
  if (/^(?:add|introduce|support|enable|implement|launch)\b/i.test(title)) return "feature";
  return "chore";
};

const ticketOf = (title: string) => title.match(/\bPS-\d+\b/i)?.[0].toUpperCase();

const utcDate = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const weekStart = (midnight: number) => midnight - ((new Date(midnight).getUTCDay() + 6) % 7) * DAY_MS;
const bucketsFrom = (first: number, last: number, interval: number) => {
  const buckets = new Map<string, MergeBucket>();
  for (let at = first; at <= last; at += interval) {
    const date = utcDate(at);
    buckets.set(date, {
      date,
      count: 0,
      categories: { bug: 0, feature: 0, chore: 0 },
      velocity: { points: 0, estimatedFeatures: 0 },
    });
  }
  return buckets;
};

const addMerge = (
  bucket: MergeBucket | undefined,
  category: PullRequestType,
  weight: number | undefined,
  defaultPoints: number,
  analysis: { theme?: number; failure?: number },
) => {
  if (!bucket) return;
  bucket.count++;
  bucket.categories[category]++;
  if (analysis.theme !== undefined) {
    bucket.themes ??= {};
    bucket.themes[analysis.theme] = (bucket.themes[analysis.theme] ?? 0) + 1;
  }
  if (analysis.failure !== undefined) {
    bucket.bugFailures ??= {};
    bucket.bugFailures[analysis.failure] = (bucket.bugFailures[analysis.failure] ?? 0) + 1;
  }
  if (category !== "feature") return;
  bucket.velocity.points += weight ?? defaultPoints;
  if (weight === undefined) bucket.velocity.estimatedFeatures++;
};

const assignmentAt = (assignments: MergeAssignments | undefined, number: number, mergedAt: number) =>
  assignments && mergedAt <= assignments.through ? assignments.byPull[number] : undefined;

export const summarizeMerges = (
  pulls: MergedPull[],
  classified: Record<string, PullRequestType>,
  through: string,
  complexity = DEFAULT_COMPLEXITY,
  audit?: BugOriginAudit,
  themes?: MergeAssignments,
  bugFailures?: MergeAssignments,
) => {
  const throughDate = through.slice(0, 10);
  const last = Date.parse(throughDate);
  const firstMerge = pulls.reduce((first, pull) => Math.min(first, Date.parse(pull.mergedAt.slice(0, 10))), Infinity);
  const daily = bucketsFrom(Math.min(firstMerge, last - 29 * DAY_MS), last, DAY_MS);
  const weekly = bucketsFrom(weekStart(firstMerge), weekStart(last), WEEK_MS);
  // Hourly buckets exist only for hours with merges; the dashboard fills the empty hours.
  const hourly = new Map<string, MergeBucket>();
  const hourOf = (mergedAt: string) => `${new Date(mergedAt).toISOString().slice(0, 13)}:00Z`;
  const hourBucket = (key: string) => {
    let bucket = hourly.get(key);
    if (!bucket) {
      bucket = {
        date: key,
        count: 0,
        categories: { bug: 0, feature: 0, chore: 0 },
        velocity: { points: 0, estimatedFeatures: 0 },
      };
      hourly.set(key, bucket);
    }
    return bucket;
  };
  for (const pull of pulls) {
    const date = pull.mergedAt.slice(0, 10);
    if (date > throughDate) continue;
    const category = classified[pull.number] ?? titleCategory(pull.title);
    const ticket = category === "feature" ? ticketOf(pull.title) : undefined;
    // 0 marks a ticket without a rating, which uses the default weight.
    const weight = ticket ? complexity.byTicket[ticket] || undefined : undefined;
    const mergedAt = Date.parse(pull.mergedAt);
    const analysis = {
      theme: assignmentAt(themes, pull.number, mergedAt),
      failure: assignmentAt(bugFailures, pull.number, mergedAt),
    };
    addMerge(daily.get(date), category, weight, complexity.defaultPoints, analysis);
    addMerge(weekly.get(utcDate(weekStart(Date.parse(date)))), category, weight, complexity.defaultPoints, analysis);
    addMerge(hourBucket(hourOf(pull.mergedAt)), category, weight, complexity.defaultPoints, analysis);
  }
  const originStats =
    audit &&
    summarizeBugOrigins(
      pulls.map(({ number, mergedAt, title }) => ({
        number,
        mergedAt,
        type: classified[number] ?? titleCategory(title),
      })),
      audit,
    );
  for (const [date, counts] of originStats?.days ?? []) {
    const day = daily.get(date);
    if (day) day.bugOrigins = counts;
    const week = weekly.get(utcDate(weekStart(Date.parse(date))));
    if (week) {
      week.bugOrigins ??= emptyBugOriginCounts();
      addBugOriginCounts(week.bugOrigins, counts);
    }
  }
  for (const [key, counts] of originStats?.hours ?? []) hourBucket(key).bugOrigins = counts;
  const allDays = [...daily.values()];
  const hours = [...hourly.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    days: allDays.slice(-30),
    allDays,
    weeks: [...weekly.values()],
    hours,
    bugOriginCoverage: originStats?.coverage,
  };
};

export const readMergeTimeline = async (files: ExtensionFiles) => {
  const timeline = await readJson<Timeline>(files, TIMELINE);
  if (!timeline?.pulls || !timeline.refreshedAt) {
    const legacy = await readJson<{ days?: PullRequestMergeBucket[] }>(files, LEGACY_AREAS);
    const days = legacy?.days?.map(({ date, count }) => ({ date, count }));
    return {
      days,
      allDays: days,
      weeks: undefined,
      hours: undefined,
      bugOriginCoverage: undefined,
      mergeThemes: undefined,
      mergeThemesError: undefined,
      bugFailurePatterns: undefined,
      bugFailurePatternsError: undefined,
      error: timeline?.error,
    };
  }
  const [saved, audit, themes, bugFailures] = await Promise.all([
    readJson<Classifications>(files, CLASSIFICATIONS),
    readJson<BugOriginAudit>(files, BUG_ORIGIN_AUDIT),
    readMergeAnalysis(files, timeline.repository, "merge-themes"),
    readMergeAnalysis(files, timeline.repository, "bug-failure-patterns"),
  ]);
  const classified = saved?.repository === timeline.repository ? (saved?.categories ?? {}) : {};
  return {
    ...summarizeMerges(
      timeline.pulls,
      classified,
      timeline.refreshedAt,
      timeline.featureComplexity,
      audit?.repository === timeline.repository ? audit : undefined,
      themes.assignments,
      bugFailures.assignments,
    ),
    mergeThemes: themes.coverage,
    mergeThemesError: themes.error,
    bugFailurePatterns: bugFailures.coverage,
    bugFailurePatternsError: bugFailures.error,
    error: timeline.error,
  };
};

export const syncMergeTimeline = async (
  ctx: Context & Pick<ExtensionContextBase, "commands">,
  files: ExtensionFiles,
) => {
  const [saved = {}, classifications] = await Promise.all([
    readJson<Timeline>(files, TIMELINE),
    readJson<Classifications>(files, CLASSIFICATIONS),
  ]);
  const result = await collectMergedPulls(ctx, saved).catch(
    (error: unknown): Timeline => ({ ...saved, error: String(error) }),
  );
  const classified = (classifications?.repository === result.repository && classifications?.categories) || {};
  const known = saved.featureComplexity?.byTicket ?? {};
  const recentFrom = Date.now() - RATING_REFRESH_MS;
  // Re-read ratings for recent features and tickets never read; older ratings come from the saved timeline.
  const tickets = (result.pulls ?? []).flatMap((pull) => {
    const ticket =
      (classified[pull.number] ?? titleCategory(pull.title)) === "feature" ? ticketOf(pull.title) : undefined;
    return ticket && (Date.parse(pull.mergedAt) >= recentFrom || !(ticket in known)) ? [ticket] : [];
  });
  const complexity = await readFeatureComplexity(ctx, tickets, saved.featureComplexity).catch(() => undefined);
  await files.writeText(
    TIMELINE,
    JSON.stringify({ ...result, featureComplexity: complexity ?? result.featureComplexity }),
  );
};
