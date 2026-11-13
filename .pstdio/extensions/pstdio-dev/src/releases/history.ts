import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { CANDIDATE_LIMIT, listReleaseJobs, listReleaseRuns, type ReleaseRun, releaseSelection } from "./github";
import {
  countTests,
  emptyCounts,
  isQuarantineJob,
  isTestJob,
  type TestCategoryCounts,
  type TestCounts,
  testJobCategory,
} from "./test-counts";
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

const readRun = async (ctx: Context, run: ReleaseRun) => {
  const jobs = await listReleaseJobs(ctx, run);
  if (!releaseSelection(run, jobs).eligible) return;
  const selected = jobs.filter((job) => isTestJob(job.name) && job.conclusion !== "skipped");
  const counts = emptyCounts();
  const categories: TestCategoryCounts = {};
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
      if (isQuarantineJob(job.name)) counts.quarantined = (counts.quarantined ?? 0) + result.passed + result.failed;
      const category = testJobCategory(job.name);
      categories[category] = (categories[category] ?? 0) + result.passed + result.failed + result.skipped;
    } catch (error) {
      errors.push(`${job.name}: ${String(error)}`);
    }
  }
  const started = Date.parse(run.run_started_at || run.created_at);
  const finished = Date.parse(run.updated_at);
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
    categories,
    runDurationSeconds:
      run.status === "completed" && Number.isFinite(started) && Number.isFinite(finished) && finished > started
        ? Math.round((finished - started) / 1000)
        : undefined,
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
    const runs = await listReleaseRuns(ctx);
    let candidates = 0;
    for (const run of runs) {
      if (candidates === CANDIDATE_LIMIT) break;
      const previous = history.runs.find((entry) => entry.id === run.id);
      if (
        previous?.status === "completed" &&
        previous.attempt === run.run_attempt &&
        !previous.errors.length &&
        previous.reportedJobs === previous.testJobs &&
        previous.counts.quarantined !== undefined &&
        previous.categories !== undefined &&
        previous.runDurationSeconds !== undefined
      ) {
        candidates++;
        continue;
      }
      const result = await readRun(ctx, run).then(
        (next) => ({ next, classified: true }),
        (error: unknown) => ({
          classified: false,
          next: previous
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
                counts: emptyCounts(),
                categories: {},
                testJobs: 0,
                reportedJobs: 0,
                pendingJobs: 0,
                failedJobs: [],
                published: false,
                errors: [String(error)],
              },
        }),
      );
      const { next } = result;
      if (!next) continue;
      if (result.classified) candidates++;
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
