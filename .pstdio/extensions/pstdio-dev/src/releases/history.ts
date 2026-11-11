import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { gh, ghJson } from "../benchmarks/github";
import { countTests, isTestJob, type TestCounts } from "./test-counts";
import type { HealthHistory } from "./types";

type Context = Pick<ExtensionContextBase, "process" | "extensionFiles">;
const HISTORY = "releases/history.json";
const filesOf = (ctx: Context) => {
  if (!ctx.extensionFiles) throw new Error("Release history needs a project.");
  return ctx.extensionFiles;
};
export const readHealth = async (ctx: Context) => {
  const files = filesOf(ctx);
  const history: HealthHistory = (await files.exists(HISTORY))
    ? JSON.parse(await files.readText(HISTORY))
    : { runs: [] };
  return history;
};
const writeHealth = (ctx: Context, value: HealthHistory) => filesOf(ctx).writeText(HISTORY, JSON.stringify(value));

interface ApiRun {
  id: number;
  run_attempt: number;
  created_at: string;
  head_sha: string;
  html_url: string;
  display_title: string;
  event: string;
  status: string;
  conclusion: string | null;
}
interface Job {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}

const readRun = async (ctx: Context, run: ApiRun) => {
  const pages = await gh(ctx, [
    "api",
    "--paginate",
    `repos/{owner}/{repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
    "--jq",
    ".jobs[]",
  ]);
  const jobs = pages
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Job);
  // Ordinary main pushes update the version PR without building or validating a release.
  const hasCandidate = jobs.some(
    (job) => /^(release_build|production \/|production_unchanged \/)/.test(job.name) && job.conclusion !== "skipped",
  );
  if (
    !hasCandidate &&
    (run.event === "push" || !jobs.some((job) => job.name === "plan" && job.conclusion !== "skipped"))
  )
    return;
  const selected = jobs.filter((job) => isTestJob(job.name) && job.conclusion !== "skipped");
  const counts: TestCounts = { passed: 0, failed: 0, skipped: 0, reports: 0 };
  const errors: string[] = [];
  let reportedJobs = 0;
  for (const job of selected.filter((entry) => entry.status === "completed")) {
    try {
      const cache = `releases/jobs/${job.id}.json`;
      const files = filesOf(ctx);
      let result: TestCounts;
      if (await files.exists(cache)) result = JSON.parse(await files.readText(cache));
      else {
        // Summarize outside the host so dependency logs never fill its bounded process output.
        const output = await ctx.process.runOrThrow({
          command: [
            "bun",
            "-e",
            `
          const child = Bun.spawn(["gh", "api", "--allow-escape-sequences", "repos/{owner}/{repo}/actions/jobs/${job.id}/logs"], { stdout: "pipe", stderr: "pipe" });
          const [log, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
          if (code !== 0) { console.error(error); process.exit(code); }
          console.log(JSON.stringify((${countTests.toString()})(log)));
        `,
          ],
        });
        result = JSON.parse(output.stdout);
        await files.writeText(cache, JSON.stringify(result));
      }
      if (result.reports) reportedJobs++;
      for (const key of ["passed", "failed", "skipped", "reports"] as const) counts[key] += result[key];
    } catch (error) {
      errors.push(`${job.name}: ${String(error)}`);
    }
  }
  return {
    id: run.id,
    attempt: run.run_attempt,
    createdAt: run.created_at,
    sha: run.head_sha,
    url: run.html_url,
    title: run.display_title,
    status: run.status,
    conclusion: run.conclusion,
    counts,
    testJobs: selected.length,
    reportedJobs,
    pendingJobs: selected.filter((job) => job.status !== "completed").length,
    failedJobs: jobs
      .filter((job) => ["failure", "timed_out", "cancelled"].includes(job.conclusion ?? ""))
      .map((job) => ({ name: job.name, url: job.html_url })),
    published: jobs.some((job) => /^publish(?:_nightly)?$/.test(job.name) && job.conclusion === "success"),
    errors,
  };
};

export const syncHealth = async (ctx: Context, changed: () => Promise<unknown>) => {
  const history = await readHealth(ctx);
  try {
    const result = await ghJson<{ workflow_runs: ApiRun[] }>(ctx, [
      "api",
      "repos/{owner}/{repo}/actions/workflows/release-packages.yml/runs?per_page=100",
    ]);
    const candidates = result.workflow_runs
      .filter((run) => run.event !== "push" || /Version Packages/.test(run.display_title))
      .slice(0, 10);
    for (const run of candidates) {
      const previous = history.runs.find((entry) => entry.id === run.id);
      if (
        previous?.status === "completed" &&
        previous.attempt === run.run_attempt &&
        !previous.errors.length &&
        previous.reportedJobs === previous.testJobs
      )
        continue;
      const next = await readRun(ctx, run).catch((error: unknown) =>
        previous
          ? {
              ...previous,
              errors: [
                `Could not refresh attempt ${run.run_attempt}; showing cached attempt ${previous.attempt}: ${String(error)}`,
              ],
            }
          : {
              id: run.id,
              attempt: run.run_attempt,
              createdAt: run.created_at,
              sha: run.head_sha,
              url: run.html_url,
              title: run.display_title,
              status: run.status,
              conclusion: run.conclusion,
              counts: { passed: 0, failed: 0, skipped: 0, reports: 0 },
              testJobs: 0,
              reportedJobs: 0,
              pendingJobs: 0,
              failedJobs: [],
              published: false,
              errors: [String(error)],
            },
      );
      if (!next) continue;
      history.runs = [...history.runs.filter((entry) => entry.id !== run.id), next].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
      history.error = undefined;
      history.syncedAt = new Date().toISOString();
      await writeHealth(ctx, history);
      await changed();
    }
  } catch (error) {
    history.error = String(error);
    await writeHealth(ctx, history);
    await changed();
    throw error;
  }
  return { runs: history.runs.length };
};
