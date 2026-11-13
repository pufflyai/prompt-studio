import { appendFileSync, readFileSync } from "node:fs";
import { productionDesktopPlatforms, productionPerformanceWorkloads } from "./production-platforms";

export interface ProductionCandidate {
  sourceSha: string;
  versionSha: string;
  toolchain: string;
  policyDigest: string;
  artifactRunId: string;
  artifactAttempt: number;
  artifacts: Array<{ id: number; name: string; digest: string }>;
}
export interface ProductionEvidence {
  candidate: ProductionCandidate;
  check: string;
  outcome: string;
  runId: string;
  attempt: number;
  artifactMode: "published" | "source-diagnostic";
}

const identity = (candidate: ProductionCandidate) =>
  JSON.stringify({ ...candidate, artifacts: [...candidate.artifacts].sort((a, b) => a.name.localeCompare(b.name)) });

const validateCandidate = (candidate: ProductionCandidate) => {
  const errors: string[] = [];
  if (
    !/^\d+$/.test(candidate.artifactRunId) ||
    !Number.isInteger(candidate.artifactAttempt) ||
    candidate.artifactAttempt < 1
  )
    errors.push("Invalid artifact producer identity");
  if (!candidate.artifacts.length) errors.push("No candidate artifacts");
  if (!/^[a-f0-9]{40}$/.test(candidate.sourceSha) || !/^[a-f0-9]{40}$/.test(candidate.versionSha))
    errors.push("Invalid source identity");
  if (!candidate.toolchain || !/^[a-f0-9]{64}$/.test(candidate.policyDigest)) errors.push("Invalid build policy");
  for (const artifact of candidate.artifacts) {
    if (!artifact.name || !/^(sha256:)?[a-f0-9]{64}$/.test(artifact.digest))
      errors.push(`${artifact.name}: missing artifact digest`);
  }
  if (new Set(candidate.artifacts.map((artifact) => artifact.name)).size !== candidate.artifacts.length)
    errors.push("Duplicate candidate artifacts");
  return errors;
};

export const certifyProduction = (
  candidate: ProductionCandidate,
  required: string[],
  evidence: ProductionEvidence[],
) => {
  const errors = validateCandidate(candidate);
  if (!required.length) errors.push("No production requirements selected");
  for (const check of required) {
    const matches = evidence.filter((entry) => entry.check === check);
    if (matches.length !== 1) {
      errors.push(`${check}: ${matches.length ? "ambiguous evidence" : "missing"}`);
      continue;
    }
    const result = matches[0]!;
    if (identity(candidate) !== identity(result.candidate)) errors.push(`${check}: candidate mismatch`);
    if (!result.runId || !Number.isInteger(result.attempt) || result.attempt < 1)
      errors.push(`${check}: missing run identity`);
    if (
      result.artifactMode === "source-diagnostic" &&
      candidate.artifacts.some((artifact) => artifact.name === "desktop-win32-x64")
    )
      errors.push(`${check}: a source diagnostic cannot certify a stable publication artifact`);
    if (!["published", "source-diagnostic"].includes(result.artifactMode))
      errors.push(`${check}: missing artifact mode`);
    if (result.outcome !== "success") errors.push(`${check}: ${result.outcome}`);
  }
  return errors;
};

export const requiredProductionChecks = (channel: string) => {
  const targets = productionDesktopPlatforms(channel).map((row) => row.target);
  return [
    "functional",
    "services",
    ...targets.flatMap((target) => [`signed-functional-${target}`, `performance-desktop-${target}`]),
    ...productionPerformanceWorkloads(channel).map((row) => `performance-${row.family}-${row.os}`),
  ];
};

export const selectProductionEvidence = (
  candidate: ProductionCandidate,
  observations: ProductionEvidence[],
  runId: string,
  attempt: number,
) => {
  const errors: string[] = [];
  const latest = new Map<string, ProductionEvidence>();
  for (const observation of observations) {
    if (
      observation.runId !== runId ||
      !Number.isInteger(observation.attempt) ||
      observation.attempt < 1 ||
      observation.attempt > attempt
    ) {
      errors.push(`${observation.check}: foreign or future workflow evidence`);
      continue;
    }
    if (identity(observation.candidate) !== identity(candidate)) {
      errors.push(`${observation.check}: candidate mismatch`);
      continue;
    }
    const previous = latest.get(observation.check);
    if (!previous || observation.attempt > previous.attempt) latest.set(observation.check, observation);
    else if (observation.attempt === previous.attempt) errors.push(`${observation.check}: ambiguous attempt evidence`);
  }
  return { evidence: [...latest.values()], errors };
};

if (import.meta.main) {
  let candidate: ProductionCandidate | null = null;
  const errors: string[] = [];
  try {
    candidate = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
  } catch {
    errors.push("candidate: identity unavailable");
  }
  const results: Record<string, { result: string }> = JSON.parse(process.env.PRODUCTION_RESULTS ?? "{}");
  const required = requiredProductionChecks(process.env.CHANNEL ?? "stable");
  const observations: ProductionEvidence[] = [];
  for await (const path of new Bun.Glob("production-evidence/**/*.json").scan(".")) {
    try {
      observations.push(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      errors.push(`${path}: invalid evidence`);
    }
  }
  let evidence = observations;
  if (candidate) {
    try {
      if (process.env.GITHUB_RUN_ID && process.env.GITHUB_RUN_ATTEMPT) {
        const selection = selectProductionEvidence(
          candidate,
          observations,
          process.env.GITHUB_RUN_ID,
          Number(process.env.GITHUB_RUN_ATTEMPT),
        );
        evidence = selection.evidence;
        errors.push(...selection.errors);
      }
      errors.push(...certifyProduction(candidate, required, evidence));
    } catch {
      candidate = null;
      errors.push("candidate: invalid identity or evidence");
    }
  }
  if (!candidate) errors.push(...required.map((check) => `${check}: missing`));
  for (const check of ["candidate", "functional", "signed_functional", "performance", "services"])
    if (results[check]?.result !== "success") errors.push(`${check}: ${results[check]?.result ?? "missing"}`);
  const releaseEligible =
    errors.length === 0 &&
    candidate !== null &&
    evidence.every((entry) => entry.artifactMode !== "source-diagnostic") &&
    candidate.artifacts.some((artifact) => artifact.name === "desktop-win32-x64");
  const certificate = { candidate, evidence, observations, complete: errors.length === 0, releaseEligible, errors };
  await Bun.write("production-certificate.json", `${JSON.stringify(certificate, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Production certification\n\n${JSON.stringify(certificate, null, 2)}\n`,
    );
  for (const error of errors) console.error(`::error::${error}`);
  if (errors.length) process.exitCode = 1;
}
