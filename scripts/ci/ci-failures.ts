import { stripVTControlCharacters } from "node:util";
import type { CiFailureCause, CiStepTiming } from "./ci-timing";

export interface CiJob {
  workflow: string;
  runId: number;
  attempt: number;
  sha: string;
  branch: string;
  event: string;
  name: string;
  id: number;
  conclusion: string | null;
  started: string | null;
  completed: string | null;
  failedSteps: string[];
  failures?: string[];
  logError?: string;
  runCreated?: string;
  created?: string | null;
  runner?: string | null;
  labels?: string[];
  steps?: CiStepTiming[];
  cause?: CiFailureCause;
}

export const parseFailedTests = (log: string) => {
  const failures = new Set<string>();
  const files = new Map<string, string>();
  const summaries = new Set<string>();
  const lines = stripVTControlCharacters(log).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s*/, "");
    const prefix = line.match(/^([@\w./-]+):\s+(.+)/);
    const scope = prefix?.[1] ?? "";
    const text = (prefix?.[2] ?? line).replace(/^(?:::group::|##\[group\])/, "").trim();
    const file = text.match(/^(.+\.(?:test|spec|bench)\.tsx?):$/)?.[1];
    if (file) {
      files.set(scope, file.replace(/\\/g, "/"));
      summaries.delete(scope);
    }
    if (/^\d+ tests? failed:/.test(text)) summaries.add(scope);
    const bun = text.match(/^(?:\(fail\)|✗)\s+(.+?)(?:\s+\[[\d.]+ms\])?\s*$/);
    if (bun && !summaries.has(scope)) {
      failures.add(["bun", scope, files.get(scope), bun[1]?.trim()].filter(Boolean).join(" | "));
    }
    const playwright = text.match(/^\d+\) (?:\[[^\]]+\] › )?(.+\.(?:spec|test|bench)\.tsx?):\d+:\d+ › (.+)$/);
    if (playwright) {
      failures.add(
        `playwright | ${playwright[1]?.replace(/\\/g, "/")} | ${playwright[2]?.replace(/\s+\(retry #\d+\)$/, "")}`,
      );
    }
  }
  return [...failures];
};

export const deduplicateJobs = (jobs: CiJob[]) => {
  const seen = new Set<string>();
  return [...jobs]
    .sort((a, b) => a.attempt - b.attempt)
    .filter((job) => {
      if (!job.started || !job.completed) return true;
      const key = [job.workflow, job.runId, job.name, job.started, job.completed].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

// Gates fail whenever a job they aggregate fails; counting them would double every failure.
const summaryJobs = new Set(["ci_passed", "validation_results", "version_pr", "nightly_prune", "desktop / targets"]);
export const isSummaryJob = (job: CiJob) => summaryJobs.has(job.name);
export const isFailedJob = (job: CiJob) => job.conclusion === "failure" || job.conclusion === "timed_out";
export const passedOnRerun = (job: CiJob, jobs: CiJob[]) =>
  jobs.some(
    (candidate) =>
      candidate.workflow === job.workflow &&
      candidate.sha === job.sha &&
      candidate.name === job.name &&
      candidate.conclusion === "success" &&
      candidate.started !== null &&
      job.completed !== null &&
      candidate.started > job.completed,
  );

export const summarizeFailures = (input: CiJob[]) => {
  const jobs = deduplicateJobs(input).filter((job) => !isSummaryJob(job));
  return {
    failures: groupFailures(jobs, (job) =>
      job.failures?.length ? job.failures : job.failedSteps.map((step) => `step | ${job.name} | ${step}`),
    ),
    steps: groupFailures(jobs, (job) => job.failedSteps.map((step) => `step | ${job.name} | ${step}`)),
    mainFirstAttempts: mainFirstAttempts(jobs),
  };
};

const groupFailures = (jobs: CiJob[], signaturesFor: (job: CiJob) => string[]) => {
  const groups = new Map<
    string,
    {
      signature: string;
      count: number;
      branches: Set<string>;
      main: number;
      release: number;
      passedOnRerun: number;
    }
  >();
  for (const job of jobs.filter(isFailedJob)) {
    const signatures = signaturesFor(job);
    if (!signatures.length) signatures.push(`job | ${job.name} | ${job.conclusion}`);
    const rerunPassed = passedOnRerun(job, jobs);
    for (const signature of signatures) {
      const group = groups.get(signature) ?? {
        signature,
        count: 0,
        branches: new Set<string>(),
        main: 0,
        release: 0,
        passedOnRerun: 0,
      };
      group.count += 1;
      group.branches.add(job.branch);
      if (job.workflow === "test-and-build.yml" && job.branch === "main") group.main += 1;
      if (job.workflow === "release-packages.yml") group.release += 1;
      if (rerunPassed) group.passedOnRerun += 1;
      groups.set(signature, group);
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, branches: [...group.branches].sort() }))
    .sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature));
};

const mainFirstAttempts = (jobs: CiJob[]) => {
  const mainRuns = new Map<number, CiJob[]>();
  for (const job of jobs) {
    if (job.workflow !== "test-and-build.yml" || job.branch !== "main" || job.event !== "push" || job.attempt !== 1)
      continue;
    const run = mainRuns.get(job.runId) ?? [];
    run.push(job);
    mainRuns.set(job.runId, run);
  }
  const complete = [...mainRuns.values()].filter((run) => run.every((job) => job.completed !== null));
  return { total: complete.length, failed: complete.filter((run) => run.some(isFailedJob)).length };
};
