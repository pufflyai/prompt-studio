import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectProductionArtifacts } from "./production-artifacts";

interface ExistingBuild {
  artifactAttempt?: number;
  artifacts?: Array<{ id: number; name: string; digest: string }>;
  sourceSha: string;
  versionSha: string;
  toolchain: string;
  payloadDigest: string;
}
export const matchingExistingBuild = (
  identity: ExistingBuild,
  sourceSha: string,
  versionSha: string,
  toolchain: string,
) =>
  identity.sourceSha === sourceSha &&
  identity.versionSha === versionSha &&
  identity.toolchain === toolchain &&
  /^[a-f0-9]{64}$/.test(identity.payloadDigest);
const github = (path: string) => {
  const result = spawnSync("gh", ["api", path], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Cannot recover daily candidate: ${result.stderr}`);
  return JSON.parse(result.stdout);
};
if (import.meta.main) {
  const [tag, sourceSha] = process.argv.slice(2);
  const repository = process.env.GH_REPO ?? process.env.GITHUB_REPOSITORY;
  const versionSha = github(`repos/${repository}/commits/${tag}`).sha as string;
  const temporary = mkdtempSync(join(tmpdir(), "pstdio-existing-candidate-"));
  let found = false;
  try {
    for (let page = 1; !found; page++) {
      const { workflow_runs: runs } = github(
        `repos/${repository}/actions/workflows/release-packages.yml/runs?branch=main&per_page=100&page=${page}`,
      );
      for (const run of runs) {
        if (run.head_sha !== sourceSha || String(run.id) === process.env.GITHUB_RUN_ID) continue;
        const artifacts = [];
        for (let artifactPage = 1; ; artifactPage++) {
          const response = github(
            `repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100&page=${artifactPage}`,
          );
          artifacts.push(...response.artifacts);
          if (response.artifacts.length < 100) break;
        }
        for (const artifact of artifacts.filter(
          (entry) => /^published-candidate-attempt-\d+$/.test(entry.name) && !entry.expired,
        )) {
          const downloaded = spawnSync("gh", ["api", `repos/${repository}/actions/artifacts/${artifact.id}/zip`]);
          if (downloaded.status !== 0) continue;
          const path = join(temporary, "identity.zip");
          writeFileSync(path, downloaded.stdout);
          const extracted = spawnSync("unzip", ["-p", path, "production-published-candidate.json"], {
            encoding: "utf8",
          });
          if (extracted.status !== 0) continue;
          const identity = JSON.parse(extracted.stdout) as ExistingBuild;
          if (!matchingExistingBuild(identity, sourceSha!, versionSha, `bun-${Bun.version}`)) continue;
          const attempt = identity.artifactAttempt;
          if (!attempt || !identity.artifacts?.length) continue;
          const retained = selectProductionArtifacts(artifacts, attempt, "nightly");
          if (
            identity.artifacts.some(
              (expected) =>
                !retained.some(
                  (actual) =>
                    actual.id === expected.id && actual.digest === expected.digest && actual.name === expected.name,
                ),
            )
          )
            continue;
          const outputs = {
            commit: versionSha,
            tag,
            version: tag!.replace(/^pstdio@/, ""),
            artifact_run_id: String(run.id),
            artifact_attempt: String(attempt),
          };
          if (process.env.GITHUB_OUTPUT)
            appendFileSync(
              process.env.GITHUB_OUTPUT,
              `${Object.entries(outputs)
                .map(([key, value]) => `${key}=${value}`)
                .join("\n")}\n`,
            );
          console.log(`Revalidate immutable nightly ${tag} from producing run ${run.id}, build attempt ${attempt}`);
          found = true;
          break;
        }
        if (found) break;
      }
      if (runs.length < 100) break;
    }
    if (!found)
      throw new Error(
        "The unchanged nightly has no retained exact candidate artifacts. Rebuild the nightly candidate; daily readiness cannot be skipped or certified from different bytes.",
      );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
