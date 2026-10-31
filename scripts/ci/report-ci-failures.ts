import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { summarizeFailures } from "./ci-failures";
import { type CiRunTiming, summarizeCiTiming } from "./ci-timing";
import { collectCiFailures } from "./collect-ci-failures";

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
const timing = summarizeCiTiming(jobs, (await Bun.file(resolve(output, "runs.json")).json()) as CiRunTiming[]);
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
  "Cancelled, skipped, incomplete and missing first attempts are not successful. Timing data is in timing.json: initial scheduling delay, elapsed after the first job starts, aggregate runner execution, and per-job phases are separate. Elapsed after start can include later scheduling gaps. Unknown PR scope and failure causes remain unclassified.",
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
await Bun.write(resolve(output, "summary.md"), markdown);
process.stdout.write(markdown);
