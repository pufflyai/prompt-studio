import { execFileSync } from "node:child_process";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CiProvenance, currentCiProvenance, requireMatchingProvenance } from "./ci-provenance";
import { evaluateCiGate, type ObservedJob, type PlannedJob } from "./test-policy";

const repository = process.env.GITHUB_REPOSITORY;
if (!repository || !process.env.GH_TOKEN) throw new Error("Missing repository provenance credentials");
const current = currentCiProvenance();
const request = async (url: string) => {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Provenance query: HTTP ${response.status}`);
  return response;
};
const api = `${process.env.GITHUB_API_URL ?? "https://api.github.com"}/repos/${repository}`;
let verified = false;
for (let page = 1; !verified; page++) {
  const body = (await (
    await request(
      `${api}/actions/workflows/test-and-build.yml/runs?event=merge_group&status=success&per_page=100&page=${page}`,
    )
  ).json()) as { workflow_runs: Array<{ id: number; head_sha: string; run_attempt: number }> };
  if (!body.workflow_runs.length) break;
  for (const run of body.workflow_runs) {
    const commit = (await (await request(`${api}/git/commits/${run.head_sha}`)).json()) as { tree: { sha: string } };
    if (commit.tree.sha !== current.tree) continue;
    const artifacts = (await (await request(`${api}/actions/runs/${run.id}/artifacts?per_page=100`)).json()) as {
      artifacts: Array<{ name: string; expired: boolean; archive_download_url: string }>;
    };
    const report = artifacts.artifacts.find(
      (artifact) => artifact.name === `ci-validation-attempt-${run.run_attempt}` && !artifact.expired,
    );
    if (!report) continue;
    const directory = await mkdtemp(join(tmpdir(), "ci-provenance-"));
    try {
      const archive = join(directory, "report.zip");
      await writeFile(archive, new Uint8Array(await (await request(report.archive_download_url)).arrayBuffer()));
      const evidence = JSON.parse(
        execFileSync("unzip", ["-p", archive, "gate-results.json"], { encoding: "utf8" }),
      ) as { sha: string; outcome: string; candidate: CiProvenance; plan: PlannedJob[]; jobs: ObservedJob[] };
      if (evidence.sha !== run.head_sha || evidence.candidate.sha !== run.head_sha || evidence.outcome !== "success")
        throw new Error("Queue artifact identity mismatch");
      requireMatchingProvenance(current, evidence.candidate);
      if (evaluateCiGate(evidence.plan, evidence.jobs, false, true).outcome !== "success")
        throw new Error("Incomplete queue evidence");
      console.log(`Main tree ${current.tree} was certified by queue run ${run.id}, attempt ${run.run_attempt}.`);
      if (process.env.GITHUB_OUTPUT)
        await appendFile(process.env.GITHUB_OUTPUT, `run_id=${run.id}\nattempt=${run.run_attempt}\n`);
      verified = true;
      break;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
if (!verified) throw new Error(`No complete successful queue evidence for main tree ${current.tree}`);
