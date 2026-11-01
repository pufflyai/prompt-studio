import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { summarizeFailures } from "./ci-failures";
import { type CiRunTiming, summarizeCiHealth, summarizeCiTiming } from "./ci-timing";
import { collectCiFailures, githubText } from "./collect-ci-failures";

const { values } = parseArgs({
  options: {
    repository: { type: "string", default: process.env.GITHUB_REPOSITORY ?? "pufflyai/prompt-studio" },
    since: { type: "string" },
    until: { type: "string" },
    output: { type: "string", default: "test-results/ci-failures" },
  },
});
const until = new Date(values.until ?? Date.now());
const since = new Date(values.since ?? until.getTime() - 7 * 24 * 60 * 60 * 1000);
if (!Number.isFinite(since.getTime()) || !Number.isFinite(until.getTime()) || since > until)
  throw new Error("Use a valid --since and --until date range.");
const output = resolve(values.output);
const jobs = await collectCiFailures(values.repository, since, until, output);
const summary = summarizeFailures(jobs);
const observedRuns = (await Bun.file(resolve(output, "runs.json")).json()) as CiRunTiming[];
const timing = summarizeCiTiming(jobs, observedRuns);
// Search dates accept seconds, not milliseconds.
const window = [since, until].map((date) => date.toISOString().replace(/\.\d+Z$/, "Z")).join("..");
const merged = JSON.parse(
  await githubText(
    `search/issues?per_page=1&q=${encodeURIComponent(`repo:${values.repository} is:pr is:merged merged:${window}`)}`,
  ),
) as { total_count: number };
const health = summarizeCiHealth(timing, jobs, observedRuns, merged.total_count);
// Entries carry no dates, so the commit that added each one gives its age. The workflow fetches full history.
const quarantine = (await Bun.file("scripts/ci/test-quarantine.json").json()) as Array<{
  file: string;
  name: string;
  owner: string;
}>;
const quarantineAges = quarantine.map((entry) => {
  const added = Bun.spawnSync([
    "git",
    "log",
    "--reverse",
    "--format=%cI",
    "-S",
    JSON.stringify(entry.name),
    "--",
    "scripts/ci/test-quarantine.json",
  ])
    .stdout.toString()
    .split("\n")[0];
  return { ...entry, added: added || null };
});
const expiredBefore = until.getTime() - 30 * 24 * 60 * 60 * 1000;
const expired = quarantineAges.filter((entry) => entry.added && Date.parse(entry.added) < expiredBefore);
const minutes = (ms: number | null) => (ms === null ? "-" : (ms / 60_000).toFixed(1));
const mainFirstAttempts = timing.runs.filter((run) => run.stage === "main");
const successful = mainFirstAttempts.filter((run) => run.firstAttemptSucceeded).length;
const total = mainFirstAttempts.length;
const rate = total ? `${((successful / total) * 100).toFixed(1)}%` : "not measured";
const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/[\r\n]/g, " ");
const unavailable = jobs.filter((job) => job.logError);
const markdown = [
  "# CI failure report",
  "",
  `Repository: ${values.repository}. Created from ${since.toISOString()} through ${until.toISOString()}.`,
  "",
  `Main first-attempt successful completion: **${rate}** (${successful}/${total} observed push runs).`,
  "",
  "## CI health",
  "",
  "Times are minutes from run creation to the last job, first attempts only. Runner minutes add up parallel jobs.",
  "",
  "| Stage | Target | p50 | p90 | Within target | First attempts failed | Runner minutes |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...health.stages.map(
    (stage) =>
      `| ${stage.stage} | ${minutes(stage.targetMs)} | ${minutes(stage.p50Ms)} | ${minutes(stage.p90Ms)} | ${stage.withinTarget}/${stage.measured} | ${stage.firstAttemptFailures}/${stage.runs} | ${stage.runnerMinutes} |`,
  ),
  "",
  `Queue runs per merge: **${health.queueRunsPerMerge === null ? "not measured" : health.queueRunsPerMerge.toFixed(2)}** (${health.queueRuns} queue runs, ${health.mergedPulls} merged PRs).`,
  "",
  `Flake rate: **${health.failedJobs ? `${((health.passedOnRerun / health.failedJobs) * 100).toFixed(1)}%` : "not measured"}** of ${health.failedJobs} failed jobs passed when rerun on the same commit. A failed queue entry gets a new commit when added again, so this undercounts queue flakes.`,
  "",
  `Quarantine: **${quarantine.length}** entries, ${expired.length} added more than 30 days ago. Entries are not removed automatically.`,
  ...expired.map(
    (entry) => `- ${cell(entry.file)}: ${cell(entry.name)} (${cell(entry.owner)}, added ${entry.added!.slice(0, 10)})`,
  ),
  "",
  "Cancelled, skipped, incomplete and missing first attempts are not successful. Timing data is in timing.json: initial scheduling delay, elapsed after the first job starts, aggregate runner execution, and per-job phases are separate. Elapsed after start can include later scheduling gaps. Failure causes remain unclassified.",
  "",
  "A later passing job on the same commit is evidence to investigate, not proof that the failed check is safe to retry.",
  "",
  "| Failing test or step | Failures | Branches | Main | Release | Passed on same-commit rerun |",
  "| --- | ---: | --- | ---: | ---: | ---: |",
  ...summary.failures.map(
    (failure) =>
      `| ${cell(failure.signature)} | ${failure.count} | ${cell(failure.branches.join(", "))} | ${failure.main} | ${failure.release} | ${failure.passedOnRerun} |`,
  ),
  "",
  "## Failed steps",
  "",
  "| Step | Failures | Branches | Main | Release | Passed on same-commit rerun |",
  "| --- | ---: | --- | ---: | ---: | ---: |",
  ...summary.steps.map(
    (failure) =>
      `| ${cell(failure.signature)} | ${failure.count} | ${cell(failure.branches.join(", "))} | ${failure.main} | ${failure.release} | ${failure.passedOnRerun} |`,
  ),
  "",
  `Unique job executions: ${jobs.length}. Failed job logs unavailable: ${unavailable.length}.`,
  ...unavailable.map(
    (job) =>
      `- [${cell(job.name)}](https://github.com/${values.repository}/actions/runs/${job.runId}/job/${job.id}): ${cell(job.logError!)}`,
  ),
  "",
].join("\n");
await Bun.write(resolve(output, "summary.json"), JSON.stringify(summary, null, 2));
await Bun.write(resolve(output, "timing.json"), JSON.stringify(timing, null, 2));
await Bun.write(resolve(output, "health.json"), JSON.stringify({ ...health, quarantine: quarantineAges }, null, 2));
await Bun.write(resolve(output, "summary.md"), markdown);
process.stdout.write(markdown);
