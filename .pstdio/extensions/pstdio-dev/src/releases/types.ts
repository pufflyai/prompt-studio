import type { TestCounts } from "./test-counts";

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
