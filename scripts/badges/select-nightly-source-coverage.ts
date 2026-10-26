import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

interface SourceRun {
  id: number;
  name: string;
  head_branch: string;
  conclusion: string;
  run_attempt: number;
}
interface SourceArtifact {
  id: number;
  name: string;
  expired: boolean;
}

export const selectNightlySourceCoverage = (
  run: SourceRun,
  artifacts: SourceArtifact[],
  publishedRunId: number,
  manual: boolean,
) => {
  if (run.name !== "Release Packages" || run.head_branch !== "main" || run.conclusion !== "success")
    throw new Error("Coverage requires a successful Release Packages run on main");
  const matches = artifacts.filter(
    (artifact) => artifact.name === `nightly-source-coverage-attempt-${run.run_attempt}` && !artifact.expired,
  );
  if (!matches.length) {
    if (manual) throw new Error(`No unexpired nightly source measurement for run ${run.id}`);
    return;
  }
  if (matches.length !== 1) throw new Error("Ambiguous nightly source coverage");
  if (run.id < publishedRunId) {
    if (manual) throw new Error(`Run ${run.id} is older than published coverage from run ${publishedRunId}`);
    return;
  }
  return { runId: run.id, artifactId: matches[0]!.id };
};

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.SOURCE_RUN_ID;
  const output = process.env.GITHUB_OUTPUT;
  if (!repository || !runId || !output) throw new Error("Missing coverage publication context");
  const path = `repos/${repository}/actions/runs/${runId}`;
  const read = (args: string[]) => JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8" }));
  const run = read([path]) as SourceRun;
  const artifacts = (
    read(["--paginate", "--slurp", `${path}/artifacts?per_page=100`]) as { artifacts: SourceArtifact[] }[]
  ).flatMap((page) => page.artifacts);
  const manual = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
  if (selectNightlySourceCoverage(run, artifacts, 0, manual)) {
    const previous = await fetch(
      `${process.env.GITHUB_API_URL ?? "https://api.github.com"}/repos/${repository}/contents/coverage-report.json?ref=badges`,
      { headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github.raw+json" } },
    );
    if (!previous.ok && previous.status !== 404)
      throw new Error(`Cannot read published coverage: HTTP ${previous.status}`);
    const published = previous.ok ? ((await previous.json()) as { workflowRunId?: number }) : null;
    const selected = selectNightlySourceCoverage(run, artifacts, published?.workflowRunId ?? 0, manual);
    if (selected) appendFileSync(output, `run_id=${selected.runId}\nartifact_id=${selected.artifactId}\n`);
    else console.log("A newer nightly source measurement is already published");
  } else console.log("This successful release run has no nightly source measurement");
}
