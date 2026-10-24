type WorkflowRun = { event: string; run_attempt: number; status: string };
type WorkflowJob = { name: string; status: string; conclusion: string | null; html_url?: string };

const failedConclusions = new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure"]);

// This is an optimization alongside ci_passed. Only the existing gate decides whether validation passes.
export const monitorMergeQueue = async (
  env: Record<string, string | undefined>,
  wait = () => new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
) => {
  if (env.GITHUB_EVENT_NAME !== "merge_group") return;

  const { GITHUB_REPOSITORY: repository, GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: attempt, GH_TOKEN: token } = env;
  if (!repository || !runId || !attempt || !token) throw new Error("Missing merge queue run identity or token");
  const root = `${env.GITHUB_API_URL ?? "https://api.github.com"}/repos/${repository}/actions/runs/${runId}`;
  const request = async (url: string, method = "GET") => {
    const response = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && !(method === "POST" && response.status === 409)) {
      throw new Error(`GitHub Actions ${method} failed: HTTP ${response.status}`);
    }
    return response;
  };
  const currentAttempt = async () => {
    const run = (await (await request(root)).json()) as WorkflowRun;
    return run.event === "merge_group" && run.run_attempt === Number(attempt) && run.status === "in_progress";
  };
  const jobs = async () => {
    const all: WorkflowJob[] = [];
    for (let page = 1; ; page++) {
      const response = await request(`${root}/attempts/${attempt}/jobs?per_page=100&page=${page}`);
      const body = (await response.json()) as { jobs: WorkflowJob[]; total_count: number };
      all.push(...body.jobs);
      if (all.length >= body.total_count || body.jobs.length === 0) return all;
    }
  };

  while (await currentAttempt()) {
    const results = await jobs();
    const failed = results.find((job) => job.status === "completed" && failedConclusions.has(job.conclusion ?? ""));
    if (failed) {
      // Reruns reuse the run ID. Recheck immediately before cancelling so an old monitor stops itself.
      if (!(await currentAttempt())) return;
      console.log(
        `Stopping merge queue run ${runId}: ${failed.name} ended with ${failed.conclusion}. ${failed.html_url ?? ""}`,
      );
      await request(`${root}/cancel`, "POST");
      return;
    }
    if (results.some((job) => job.name === "ci_passed" && job.status === "completed")) return;
    await wait();
  }
};

if (import.meta.main) {
  try {
    await monitorMergeQueue(process.env);
  } catch (error) {
    // An unavailable optimization must not create a new queue failure. ci_passed still enforces every check.
    console.warn(`::warning::Queue cancellation monitor stopped; normal validation continues. ${String(error)}`);
  }
}
