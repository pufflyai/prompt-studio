import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { catalogRevision, conversationFixture, scenarioById } from "./scenarios";

export const scenarioEvidence = (
  file: string,
  id: string,
  expected: {
    source: string;
    platform: string;
    catalogDigest: string;
    planDigest?: string;
    runId?: string;
    executionId?: string;
  },
) => {
  const scenario = scenarioById(id);
  const events = readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const fingerprint = createHash("sha256").update(JSON.stringify({ scenario, conversationFixture })).digest("hex");
  const first = events[0];
  const last = events.at(-1);
  if (
    !first ||
    first.event !== "started" ||
    last?.event !== "finished" ||
    events.filter((event) => event.event === "started").length !== 1 ||
    events.filter((event) => event.event === "finished").length !== 1 ||
    events.some((event) => event.event === "failed")
  )
    throw new Error(`${id}: incomplete or failed first-attempt evidence`);
  const sameHost = ["host", "cpu", "cores", "memoryBytes", "cache", "throttle", "units", "memoryMetric"];
  if (
    typeof first.cpu !== "string" ||
    !first.cpu ||
    !Number.isInteger(first.cores) ||
    first.cores < 1 ||
    !Number.isFinite(first.memoryBytes) ||
    first.memoryBytes <= 0 ||
    first.cache !== scenario.cache ||
    first.throttle !== scenario.throttle
  )
    throw new Error(`${id}: missing or unlike host/cache/throttle identity`);
  for (const event of events) {
    if (sameHost.some((key) => event[key] !== first[key])) throw new Error(`${id}: mixed workload host identity`);
    if (
      event.scenario !== id ||
      event.catalogRevision !== catalogRevision ||
      event.workloadVersion !== (scenario.id === "B5" ? scenario.workloadVersion : 1) ||
      (scenario.id === "B5" && event.memoryMetric !== scenario.memoryMetrics[expected.platform.split("-")[0]!]) ||
      event.fingerprint !== fingerprint ||
      event.dirty ||
      event.sample !== 0 ||
      Object.entries(expected).some(([key, value]) => event[key] !== value)
    )
      throw new Error(`${id}: stale or unlike workload evidence`);
  }
  const metrics = events.filter((event) => event.event === "metric");
  if (
    metrics.length !== scenario.metrics.length ||
    new Set(metrics.map((metric) => metric.name)).size !== metrics.length ||
    scenario.metrics.some(
      (metric) =>
        !metrics.some(
          (observed) =>
            observed.name === metric.id &&
            observed.unit === metric.unit &&
            Number.isFinite(observed.value) &&
            (observed.budget === undefined || observed.value <= observed.budget),
        ),
    )
  )
    throw new Error(`${id}: missing, unexpected, invalid or over-budget measurement`);
  return {
    nativeFailure: last.qualification !== "qualified" || last.missing.length > 0 || last.failed.length > 0,
    metrics,
  };
};
