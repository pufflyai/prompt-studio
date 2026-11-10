import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { productionPolicyDigest, requireProductionBuild, selectProductionArtifacts } from "./production-artifacts";
import type { ProductionCandidate } from "./production-candidate";
import { assertProductionPayload } from "./production-payload";

interface ConsumerEvidence {
  candidate: ProductionCandidate;
  actualSha: string;
  toolchain: string;
  check: string;
  outcome: string;
  runId: string;
  attempt: number;
  artifactMode?: "published" | "source-diagnostic";
}
export const recordProductionEvidence = (input: ConsumerEvidence) => {
  if (input.actualSha !== input.candidate.versionSha || input.toolchain !== input.candidate.toolchain)
    throw new Error("Consumer checkout or toolchain differs from the candidate");
  return {
    candidate: input.candidate,
    check: input.check,
    outcome: input.outcome,
    runId: input.runId,
    attempt: input.attempt,
    artifactMode: input.artifactMode ?? "published",
  };
};

const run = (command: string, args: string[]) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} could not read production provenance: ${result.stderr}`);
  return result.stdout.trim();
};

if (import.meta.main) {
  const option = (name: string) => process.argv[process.argv.indexOf(name) + 1];
  const actualSha = run("git", ["rev-parse", "HEAD"]);
  // The producer freezes the artifact inventory once. Relisting while other jobs
  // upload reports can move entries between API pages and change the observation.
  const candidate: ProductionCandidate = JSON.parse(readFileSync("production-candidate.json", "utf8"));
  if (
    candidate.artifactRunId !== process.env.ARTIFACT_RUN_ID ||
    candidate.artifactAttempt !== Number(process.env.ARTIFACT_ATTEMPT) ||
    candidate.sourceSha !== process.env.SOURCE_SHA ||
    candidate.policyDigest !== productionPolicyDigest()
  )
    throw new Error("Consumer candidate provenance mismatch");
  selectProductionArtifacts(
    candidate.artifacts.map((artifact) => ({ ...artifact, expired: false })),
    candidate.artifactAttempt,
    process.env.CHANNEL!,
  );
  // The archive's build identity must agree with this consumer's actual checkout,
  // rather than assigning expected candidate identity to a job result afterward.
  const buildIdentity = JSON.parse(readFileSync("production-build-identity.json", "utf8"));
  requireProductionBuild(buildIdentity, candidate);
  if (buildIdentity.payloadName) await assertProductionPayload(buildIdentity);
  const evidence = recordProductionEvidence({
    candidate,
    actualSha,
    toolchain: `bun-${Bun.version}`,
    check: option("--check")!,
    outcome: option("--outcome")!,
    runId: process.env.GITHUB_RUN_ID!,
    attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    artifactMode: buildIdentity.payloadName ? "published" : "source-diagnostic",
  });
  mkdirSync("production-evidence", { recursive: true });
  await Bun.write(`production-evidence/${evidence.check}.json`, `${JSON.stringify(evidence, null, 2)}\n`);
}
