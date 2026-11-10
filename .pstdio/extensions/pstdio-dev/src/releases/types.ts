import type { TestCategoryCounts, TestCounts } from "./test-counts";

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
  testJobs: number;
  reportedJobs: number;
  pendingJobs: number;
  failedJobs: { name: string; url: string }[];
  published: boolean;
  errors: string[];
}

export interface HealthHistory {
  runs: ReleaseHealth[];
  syncedAt?: string;
  error?: string;
}
