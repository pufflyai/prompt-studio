import { mkdir, writeFile } from "node:fs/promises";
import { currentCiProvenance } from "./ci-provenance";
import { createCiResultsClient, TemporaryCiResultsError } from "./ci-results-client";
import { evaluateCiGate, isGateJob, matchesJob, type ObservedJob, type PlannedJob } from "./test-policy";

interface Job extends ObservedJob {
  id: number;
  started_at: string | null;
  completed_at: string | null;
}

export const monitorCiGates = async (
  env: Record<string, string | undefined>,
  plan: PlannedJob[],
  wait = () => new Promise<void>((resolve) => setTimeout(resolve, 5000)),
  now = Date.now,
) => {
  if (!plan.length) throw new Error("No selected CI jobs");
  const repository = env.GITHUB_REPOSITORY;
  const runId = env.GITHUB_RUN_ID;
  const attempt = Number(env.GITHUB_RUN_ATTEMPT);
  if (!repository || !runId || !attempt || !env.GH_TOKEN) throw new Error("Missing CI run identity");
  const base = `${env.GITHUB_API_URL ?? "https://api.github.com"}/repos/${repository}/actions/runs/${runId}`;
  const request = createCiResultsClient(env.GH_TOKEN, now);
  const read = async () => {
    const run = (await request(base)) as { run_attempt: number; head_sha: string };
    const jobs: Job[] = [];
    for (let page = 1; ; page++) {
      const body = (await request(`${base}/attempts/${attempt}/jobs?per_page=100&page=${page}`)) as {
        jobs: Job[];
        total_count: number;
      };
      jobs.push(...body.jobs);
      if (jobs.length >= body.total_count || !body.jobs.length) return { run, jobs };
    }
  };
  let previous = "";
  for (;;) {
    let observed: Awaited<ReturnType<typeof read>>;
    try {
      observed = await read();
    } catch (error) {
      // An unread graph is still pending; the job's execution allowance bounds the wait.
      if (!(error instanceof TemporaryCiResultsError)) throw error;
      console.warn(`::warning::${error.message}; waiting for the next read`);
      await wait();
      continue;
    }
    const { run, jobs } = observed;
    if (run.run_attempt !== attempt) throw new Error("CI run was superseded by another attempt");
    const monitor = jobs.find((job) => job.name === "validation_results" || job.name.endsWith(" / validation_results"));
    const prefix = monitor?.name.slice(0, -"validation_results".length) ?? "";
    const suite = jobs.filter((job) => job.name.startsWith(prefix));
    const independent = suite.filter((job) => !isGateJob(job.name));
    const snapshot = JSON.stringify(independent.map((job) => [job.id, job.status, job.conclusion]));
    if (snapshot !== previous) {
      const pending = independent.filter((job) => job.status !== "completed").map((job) => job.name);
      console.log(
        `CI results: ${independent.length - pending.length}/${independent.length} finished; pending: ${pending.join(", ") || "none"}`,
      );
    }
    const staticObserved =
      !plan.some((expected) => expected.id === "static_checks") ||
      independent.some((job) => matchesJob(job.name, "static_checks"));
    // Wait for a stable finished graph, not downstream certification jobs that await this result.
    const settled =
      staticObserved &&
      independent.length > 0 &&
      independent.every((job) => job.status === "completed") &&
      snapshot === previous;
    const decision = evaluateCiGate(plan, suite, env.CI_PROFILE !== "production", settled);
    if (decision.outcome !== "pending") {
      console.log(`CI gate: ${decision.outcome}; settled: ${settled}`);
      return { ...decision, runId, attempt, sha: run.head_sha, plan, jobs };
    }
    previous = snapshot;
    await wait();
  }
};

if (import.meta.main) {
  const result = await monitorCiGates(process.env, JSON.parse(process.env.CI_GATE_PLAN ?? "[]"));
  await mkdir("test-results/ci", { recursive: true });
  await writeFile(
    "test-results/ci/gate-results.json",
    `${JSON.stringify({ ...result, candidate: currentCiProvenance() }, null, 2)}\n`,
  );
  for (const failure of result.failures) console.error(`::error::${failure}`);
  if (result.outcome !== "success") process.exitCode = 1;
}
