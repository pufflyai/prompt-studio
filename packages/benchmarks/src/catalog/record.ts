import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { cpus, hostname, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { type BenchmarkUnit, recordMeasurement } from "../writer";
import { readContract } from "./contract";
import { retainedLimit } from "./limits";
import { catalogRevision, conversationFixture, type ScenarioId, scenarioById } from "./scenarios";

export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** One completed observation per declared metric. Raw observations are written before limits are checked. */
export const runScenario = async (
  id: ScenarioId,
  workload: (capture: Awaited<ReturnType<typeof createCapture>>) => Promise<void>,
) => {
  const capture = await createCapture(id);
  try {
    await workload(capture);
    capture.finish();
  } catch (error) {
    capture.failure(error);
    throw error;
  }
};

const createCapture = async (id: ScenarioId) => {
  const root = resolve(import.meta.dir, "../../../..");
  const contract = readContract(root);
  const baseline = process.env.BENCHMARK_BASELINE === "1";
  const scenario = scenarioById(id);
  const platform = `${process.platform}-${process.arch}`;
  if (!(scenario.platforms as readonly string[]).includes(platform)) throw new Error(`${id} does not own ${platform}`);
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (process.env.BENCHMARK_SOURCE_SHA && process.env.BENCHMARK_SOURCE_SHA !== sha)
    throw new Error("The benchmark source differs from the planned candidate");
  const identity = {
    catalogRevision,
    catalogDigest: contract.digest,
    scenario: id,
    workloadVersion: 1,
    planDigest: process.env.CI_PLAN_DIGEST,
    runId: process.env.CI_PLAN_RUN_ID,
    executionId: process.env.CI_TEST_EXECUTION_ID,
    dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
    fingerprint: fingerprint({ scenario, conversationFixture }),
    source: sha,
    platform,
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memoryBytes: totalmem(),
    host: hostname(),
    cache: scenario.cache,
    throttle: scenario.throttle,
    sample: Number(process.env.BENCHMARK_SAMPLE_INDEX ?? 0),
    units: "decimal bytes; monotonic milliseconds",
  };
  const pendingGuards = scenario.metrics
    .filter((metric) => metric.kind === "pending-guard" && !retainedLimit(id, metric.id))
    .map((metric) => metric.id);
  const eligibility = !baseline && !identity.dirty && !pendingGuards.length;
  const measurementIdentity = { ...identity, qualificationEligible: eligibility };
  const observations = new Map<string, { value: number; unit: BenchmarkUnit; budget?: number; kind: string }>();
  const evidence =
    process.env.BENCHMARK_EVIDENCE ??
    `${process.env.BENCHMARK_EVIDENCE_DIR ?? "test-results/production-performance"}/${id}.jsonl`;
  mkdirSync(dirname(evidence), { recursive: true });
  const write = (value: object) => appendFileSync(evidence, `${JSON.stringify({ ...identity, ...value })}\n`);
  write({ event: "started", at: new Date().toISOString(), metrics: scenario.metrics });
  return {
    id,
    scenario,
    identity,
    detail: (name: string, value: unknown) => write({ event: "observation", name, value }),
    record(name: string, value: number, supplied?: { value: number; evidence: string }) {
      const budget = retainedLimit(id, name);
      if (supplied && (!budget || supplied.value !== budget.value || supplied.evidence !== budget.evidence))
        throw new Error(`${id}/${name}: unapproved numeric limit`);
      const expected = scenario.metrics.find((entry) => entry.id === name);
      if (!expected) throw new Error(`${id}: undeclared metric ${name}`);
      if (!Number.isFinite(value) || value < 0) throw new Error(`${id}: missing or invalid metric ${name}`);
      if (observations.has(name)) throw new Error(`${id}: duplicate metric ${name}`);
      const metric = { value, unit: expected.unit, kind: expected.kind, ...(budget && { budget: budget.value }) };
      observations.set(name, metric);
      write({ event: "metric", name, ...metric, budgetEvidence: budget?.evidence ?? null });
      recordMeasurement({
        metric: `${id}/${name}`,
        label: `${scenario.label}: ${name}`,
        unit: metric.unit,
        value,
        identity: measurementIdentity,
        ...(budget && { budget: budget.value }),
      });
    },
    finish() {
      const missing = scenario.metrics.filter((entry) => !observations.has(entry.id)).map((entry) => entry.id);
      const failed = [...observations].filter(
        ([, metric]) => metric.budget !== undefined && metric.value > metric.budget,
      );
      const pending = scenario.metrics
        .filter((metric) => metric.kind === "pending-guard" && !retainedLimit(id, metric.id))
        .map((metric) => metric.id);
      const qualification = eligibility && !missing.length && !failed.length ? "qualified" : "unqualified";
      write({ event: "finished", missing, failed, pending, qualification });
      if (missing.length) throw new Error(`${id}: missing required metrics: ${missing.join(", ")}`);
      if (failed.length) throw new Error(`${id}: failed approved limits: ${failed.map(([name]) => name).join(", ")}`);
      if (qualification !== "qualified" && !baseline)
        throw new Error(`${id}: unqualified workload; clean source and human-approved limits are required`);
    },
    failure: (error: unknown) => write({ event: "failed", error: String(error) }),
  };
};

export type ScenarioCapture = Awaited<ReturnType<typeof createCapture>>;
