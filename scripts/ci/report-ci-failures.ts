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
// A failed search loses one figure, not the week of collected runs.
const mergedPulls = await githubText(
  `search/issues?per_page=1&q=${encodeURIComponent(`repo:${values.repository} is:pr is:merged merged:${window}`)}`,
)
  .then((text) => (JSON.parse(text) as { total_count: number }).total_count)
  .catch(() => null);
const health = summarizeCiHealth(timing, jobs, observedRuns, mergedPulls);
// Entries carry no dates. The oldest commit that touched an entry's own lines added it; names
// repeat across platforms, so a text search would date the first entry with that name.
// The workflow fetches full history.
const quarantinePath = "scripts/ci/test-quarantine.json";
const quarantineLines = (await Bun.file(quarantinePath).text()).split("\n");
const quarantine = JSON.parse(quarantineLines.join("\n")) as Array<{ file: string; name: string; owner: string }>;
const entryStarts = quarantineLines.flatMap((line, index) => (line === "  {" ? [index + 1] : []));
const entryEnds = quarantineLines.flatMap((line, index) => (/^  },?$/.test(line) ? [index + 1] : []));
if (entryStarts.length !== quarantine.length || entryEnds.length !== quarantine.length)
  throw new Error(`${quarantinePath} must keep one entry object per indented block to date its entries.`);
const quarantineAges = quarantine.map((entry, index) => {
  const history = Bun.spawnSync([
    "git",
    "log",
    "-s",
    "--format=%cI",
    "-L",
    `${entryStarts[index]},${entryEnds[index]}:${quarantinePath}`,
  ]).stdout.toString();
  return { ...entry, added: history.match(/^\d{4}-\S+$/gm)?.at(-1) ?? null };
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
  "Times are minutes from run creation to the last job. Only first attempts whose required gate passed or failed count; superseded, approval-pending and gate-less runs are left out. Runner minutes add up every job of every attempt, including reruns.",
  "",
  "| Stage | Target | p50 | p90 | Within target | First attempts failed | Runner minutes |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...health.stages.map(
    (stage) =>
      `| ${stage.stage} | ${minutes(stage.targetMs)} | ${minutes(stage.p50Ms)} | ${minutes(stage.p90Ms)} | ${stage.withinTarget}/${stage.measured} | ${stage.firstAttemptFailures}/${stage.runs} | ${stage.runnerMinutes} |`,
  ),
  "",
  `Queue runs per merge: **${health.queueRunsPerMerge === null ? "not measured" : health.queueRunsPerMerge.toFixed(2)}** (${health.queueRuns} queue runs, ${health.mergedPulls ?? "unknown"} merged PRs).`,
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
