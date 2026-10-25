import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type CiJob, deduplicateJobs, isFailedJob, isSummaryJob, parseFailedTests } from "./ci-failures";

interface WorkflowRun {
  id: number;
  run_attempt: number;
  head_sha: string;
  head_branch: string;
  event: string;
  created_at: string;
}
interface WorkflowJob {
  id: number;
  name: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at?: string;
  runner_name?: string;
  labels?: string[];
  steps: Array<{ name: string; conclusion: string | null; started_at?: string; completed_at?: string }>;
}

const githubText = async (endpoint: string) => {
  const child = Bun.spawn(["gh", "api", "--allow-escape-sequences", endpoint], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`GitHub ${endpoint} failed (${code}): ${stderr.trim()}`);
  return stdout;
};

const paginatedJobs = async (endpoint: string) => {
  const jobs: WorkflowJob[] = [];
  for (let page = 1; ; page += 1) {
    const response = JSON.parse(await githubText(`${endpoint}?per_page=100&page=${page}`)) as { jobs: WorkflowJob[] };
    jobs.push(...response.jobs);
    if (response.jobs.length < 100) return jobs;
  }
};

export const collectCiFailures = async (repository: string, since: Date, until: Date, output: string) => {
  mkdirSync(output, { recursive: true });
  const runs: Array<WorkflowRun & { workflow: string }> = [];
  for (const workflow of ["test-and-build.yml", "release-packages.yml"]) {
    // Listing without a search filter avoids the REST search result cap for large date ranges.
    for (let page = 1; ; page += 1) {
      const response = JSON.parse(
        await githubText(`repos/${repository}/actions/workflows/${workflow}/runs?per_page=100&page=${page}`),
      ) as { workflow_runs: WorkflowRun[] };
      for (const run of response.workflow_runs) {
        const created = new Date(run.created_at);
        if (created >= since && created <= until) runs.push({ ...run, workflow });
      }
      const oldest = response.workflow_runs.at(-1);
      if (response.workflow_runs.length < 100 || (oldest && new Date(oldest.created_at) < since)) break;
    }
  }
  await Bun.write(join(output, "runs.json"), JSON.stringify(runs, null, 2));
  const requests = runs.flatMap((run) =>
    Array.from({ length: run.run_attempt }, (_, index) => ({ run, attempt: index + 1 })),
  );
  const jobs: CiJob[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < requests.length) {
        const request = requests[next++]!;
        const found = await paginatedJobs(
          `repos/${repository}/actions/runs/${request.run.id}/attempts/${request.attempt}/jobs`,
        );
        for (const job of found)
          jobs.push({
            workflow: request.run.workflow,
            runId: request.run.id,
            attempt: request.attempt,
            sha: request.run.head_sha,
            branch: request.run.head_branch,
            event: request.run.event,
            id: job.id,
            name: job.name,
            conclusion: job.conclusion,
            started: job.started_at,
            completed: job.completed_at,
            runCreated: request.run.created_at,
            created: job.created_at ?? null,
            runner: job.runner_name ?? null,
            labels: job.labels,
            steps: job.steps.map((step) => ({
              name: step.name,
              started: step.started_at ?? null,
              completed: step.completed_at ?? null,
            })),
            failedSteps: job.steps.filter((step) => step.conclusion === "failure").map((step) => step.name),
          });
      }
    }),
  );
  const unique = deduplicateJobs(jobs);
  const failures = unique.filter((job) => isFailedJob(job) && !isSummaryJob(job));
  next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < failures.length) {
        const job = failures[next++]!;
        try {
          job.failures = parseFailedTests(await githubText(`repos/${repository}/actions/jobs/${job.id}/logs`));
        } catch (error) {
          job.logError = String(error);
        }
      }
    }),
  );
  await Bun.write(join(output, "jobs.json"), JSON.stringify(unique, null, 2));
  return unique;
};
