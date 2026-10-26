import { createCiResultsClient } from "./ci-results-client";
import { matchesJob, type ObservedJob, type PlannedJob, priorityForJob } from "./test-policy";

export const failedP1Job = (jobs: ObservedJob[], plan: PlannedJob[] = []) =>
  jobs.find((job) => {
    const selected = plan.find((expected) => matchesJob(job.name, expected.id));
    if (plan.length && !selected) return false;
    if (/windows_|win32|cli-win/.test(job.name)) return false;
    return (
      (selected?.priority ?? priorityForJob(job.name)) === "P1" &&
      job.status === "completed" &&
      ["failure", "timed_out", "startup_failure", "action_required"].includes(job.conclusion ?? "")
    );
  });

export const createP1Observer = (env: NodeJS.ProcessEnv) => {
  const request = createCiResultsClient(env.GH_TOKEN ?? "");
  return async () => {
    if (!env.GITHUB_RUN_ID || !env.GITHUB_RUN_ATTEMPT || !env.GITHUB_REPOSITORY || !env.GH_TOKEN) return;
    const url = `${env.GITHUB_API_URL ?? "https://api.github.com"}/repos/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT}/jobs`;
    for (let page = 1; ; page++) {
      const body = (await request(`${url}?per_page=100&page=${page}`)) as {
        jobs: ObservedJob[];
        total_count: number;
      };
      const failed = failedP1Job(body.jobs, JSON.parse(env.CI_GATE_PLAN ?? "[]"));
      if (failed) return failed;
      if (page * 100 >= body.total_count || !body.jobs.length) return;
    }
  };
};
