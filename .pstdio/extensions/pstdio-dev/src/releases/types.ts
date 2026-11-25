import type { TestCategoryCounts, TestCounts } from "./test-counts";

export const PULL_REQUEST_TYPES = ["bug", "feature", "chore"] as const;
export type PullRequestType = (typeof PULL_REQUEST_TYPES)[number];

export interface ReleaseHealth {
  id: number;
  attempt: number;
  createdAt: string;
  sha: string;
  url: string;
  title: string;
  status: string;
  conclusion: string | null;
  counts: TestCounts;
  /** Total tests per category. Absent in history cached before categories were tracked. */
  categories?: TestCategoryCounts;
  /** Total run duration from start to completion. Absent in history cached before it was tracked. */
  runDurationSeconds?: number;
  /** Failing tests per category. Absent in history cached before failures were tracked by category. */
  failedCategories?: TestCategoryCounts;
  testJobs: number;
  reportedJobs: number;
  pendingJobs: number;
  failedJobs: { name: string; url: string }[];
  published: boolean;
  errors: string[];
}

export interface PullRequestMergeBucket {
  date: string;
  count: number;
  categories?: Record<PullRequestType, number>;
  /** Counts keyed by index in MergeThemeCoverage.names. */
  themes?: Record<number, number>;
  bugFailures?: Record<number, number>;
  velocity?: { points: number; estimatedFeatures: number };
  bugOrigins?: BugOriginCounts;
}

export interface MergeThemeCoverage {
  analyzedAt: string;
  names: string[];
  validationIndices?: number[];
}

export interface BugOriginCounts {
  features: number;
  fixes: number;
  inferred: number;
}

export interface BugOriginCoverage {
  reviewedThrough: string;
  reviewed: number;
  mergedReviewed: number;
  linkedToFeatures: number;
  linkedToOther: number;
  preMergeFixes: number;
  unlinked: number;
}

export interface ReleasePublication {
  tag: string;
  publishedAt: string;
}

export interface HealthHistory {
  runs: ReleaseHealth[];
  syncedAt?: string;
  error?: string;
  pullRequestMerges?: PullRequestMergeBucket[];
  pullRequestMergesDaily?: PullRequestMergeBucket[];
  pullRequestMergesWeekly?: PullRequestMergeBucket[];
  /** Hours with merges, keyed like `2026-11-20T09:00Z` (UTC). */
  pullRequestMergesHourly?: PullRequestMergeBucket[];
  pullRequestMergesError?: string;
  mergeThemes?: MergeThemeCoverage;
  mergeThemesError?: string;
  bugFailurePatterns?: MergeThemeCoverage;
  bugFailurePatternsError?: string;
  bugOriginCoverage?: BugOriginCoverage;
  publications?: ReleasePublication[];
  publicationsError?: string;
}
