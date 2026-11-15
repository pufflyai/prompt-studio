import { execFileSync } from "node:child_process";

export const requiredTurnaroundMs = 10 * 60_000;
interface Job {
  name: string;
  conclusion: string | null;
  created_at?: string;
  started_at: string | null;
  completed_at: string | null;
  steps: { name: string; started_at: string | null; completed_at: string | null }[];
}
interface Run {
  id: number;
  head_sha: string;
  event: string;
  run_attempt: number;
  created_at: string;
  conclusion: string | null;
}
const elapsed = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  const value = Date.parse(end) - Date.parse(start);
  return Number.isFinite(value) && value >= 0 ? value : null;
};
export const qualifyRequiredTurnaround = (run: Run, jobs: Job[], cache?: "cold" | "warm") => {
  const gate = jobs.find((job) => job.name === "ci_passed");
  const elapsedMs = elapsed(run.created_at, gate?.completed_at);
  const selected = jobs.filter((job) => job.conclusion !== "skipped");
  const waits = selected.map((job) => elapsed(job.created_at, job.started_at));
  const complete = selected.every((job) => job.completed_at && job.conclusion === "success");
  return {
    runId: run.id,
    sha: run.head_sha,
    event: run.event,
    attempt: run.run_attempt,
    cache: cache ?? "unknown",
    targetMs: requiredTurnaroundMs,
    elapsedMs,
    runnerWaitMs: waits.every((wait) => wait !== null) ? waits.reduce((sum, wait) => sum + wait, 0) : null,
    qualified: Boolean(
      cache &&
        run.run_attempt === 1 &&
        ["pull_request", "merge_group"].includes(run.event) &&
        run.conclusion === "success" &&
        gate?.conclusion === "success" &&
        complete &&
        elapsedMs !== null &&
        elapsedMs <= requiredTurnaroundMs,
    ),
    jobs: selected.map((job) => ({
      name: job.name,
      outcome: job.conclusion,
      runnerWaitMs: elapsed(job.created_at, job.started_at),
      elapsedMs: elapsed(job.started_at, job.completed_at),
      phases: job.steps.map((step) => ({ name: step.name, elapsedMs: elapsed(step.started_at, step.completed_at) })),
    })),
  };
};

if (import.meta.main) {
  const id = process.argv[2];
  if (!id || !/^\d+$/.test(id)) throw new Error("Pass a completed required-profile workflow run ID");
  const cache = process.argv[3];
  if (cache && cache !== "cold" && cache !== "warm") throw new Error("Cache provenance must be cold or warm");
  const repository = process.env.GITHUB_REPOSITORY ?? "pufflyai/prompt-studio";
  const api = (path: string) => JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8" }));
  const run = api(`repos/${repository}/actions/runs/${id}`) as Run;
  const jobs: Job[] = [];
  for (let page = 1; ; page++) {
    const result = api(
      `repos/${repository}/actions/runs/${id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`,
    );
    jobs.push(...result.jobs);
    if (result.jobs.length < 100) break;
  }
  const report = qualifyRequiredTurnaround(run, jobs, cache as "cold" | "warm" | undefined);
  const path = `test-results/ci/turnaround-${id}.json`;
  await Bun.write(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.qualified) process.exitCode = 1;
}
