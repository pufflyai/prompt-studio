import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { productionPolicyDigest } from "./production-artifacts";
import type { ProductionCandidate } from "./production-candidate";

interface Artifact {
  id: number;
  name: string;
  digest: string;
  expired?: boolean;
}
interface Certificate {
  candidate: ProductionCandidate;
  complete: boolean;
  releaseEligible: boolean;
}
export const requireCertifiedPublication = (
  certificate: Certificate,
  actual: Artifact[],
  versionSha: string,
  toolchain: string,
  policyDigest: string,
) => {
  if (!certificate.complete || !certificate.releaseEligible)
    throw new Error("A complete release-eligible certificate is required");
  if (
    certificate.candidate.versionSha !== versionSha ||
    certificate.candidate.toolchain !== toolchain ||
    certificate.candidate.policyDigest !== policyDigest
  )
    throw new Error("Publication source, toolchain or policy changed after certification");
  for (const expected of certificate.candidate.artifacts) {
    const artifact = actual.find((entry) => entry.id === expected.id);
    if (!artifact || artifact.expired || artifact.name !== expected.name || artifact.digest !== expected.digest)
      throw new Error(`Certified artifact ${expected.name} changed or expired before publication`);
  }
};
if (import.meta.main) {
  const certificate = JSON.parse(readFileSync("production-certificate.json", "utf8")) as Certificate;
  const read = (args: string[]) => {
    const result = spawnSync("gh", args, { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Could not bind certified publication: ${result.stderr}`);
    return result.stdout;
  };
  const pages = JSON.parse(
    read([
      "api",
      "--paginate",
      "--slurp",
      `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${certificate.candidate.artifactRunId}/artifacts?per_page=100`,
    ]),
  );
  const actual = pages.flatMap((page: { artifacts: Artifact[] }) => page.artifacts) as Artifact[];
  const versionSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  requireCertifiedPublication(certificate, actual, versionSha, `bun-${Bun.version}`, productionPolicyDigest());
  const ids = (prefix: string) =>
    certificate.candidate.artifacts
      .filter((entry) => entry.name.startsWith(prefix))
      .map((entry) => entry.id)
      .join(",");
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `desktop_ids=${ids("desktop-")}\nservice_ids=${ids("service-container-")}\n`,
    );
}
