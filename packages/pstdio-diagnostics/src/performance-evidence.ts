import type { PerformanceCapture, PerformanceProcessSample } from "pstdio-api-contracts/performance-diagnostics";

type Role = PerformanceProcessSample["role"];
type Reading = { elapsedMs: number; value: PerformanceProcessSample };

const roleExists = (sample: PerformanceCapture["samples"][number], role: Role) =>
  sample.processes.some((process) => process.role === role) ||
  (role === "backend" && sample.backend.scope === "local" && sample.backend.state === "reply");

const maximum = (values: (number | null)[]) => {
  const measured = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return measured.length ? Math.max(...measured) : null;
};

const memoryPeak = (observed: (number | null)[], lifetime: (number | null)[], bornDuringCapture: boolean) => {
  const nativePeak = bornDuringCapture ? maximum(lifetime) : null;
  return {
    value: maximum([...observed, nativePeak]),
    coverage: nativePeak === null ? "observed-samples" : "process-lifetime",
  };
};

const processSummary = (readings: Reading[], capture: PerformanceCapture, operationEndedAt?: number) => {
  const first = readings[0]!;
  const last = readings.at(-1)!;
  const cpu = readings.map(({ value }) => value.cpuTimeMs);
  const startedAt = Date.parse(first.value.startedAt ?? "");
  const captureStartedAt = capture.startedAt;
  const settled =
    operationEndedAt !== undefined &&
    Date.parse(captureStartedAt) + last.elapsedMs >= operationEndedAt + capture.sampleIntervalMs;
  const bornDuringCapture =
    startedAt >= Date.parse(captureStartedAt) && startedAt <= Date.parse(captureStartedAt) + first.elapsedMs;
  const hasCpu =
    (cpu.length > 1 || bornDuringCapture) && cpu.every((value) => value !== null && Number.isFinite(value));
  const monotonicCpu = hasCpu && cpu.every((value, index) => index === 0 || value! >= cpu[index - 1]!);
  let cpuCoverage = "unavailable";
  if (monotonicCpu) cpuCoverage = bornDuringCapture ? "process-lifetime" : "between-readings";
  const residentPeak = memoryPeak(
    readings.map(({ value }) => value.residentBytes),
    readings.map(({ value }) => value.peakResidentBytes),
    bornDuringCapture,
  );
  const footprintPeak = memoryPeak(
    readings.map(({ value }) => value.physicalFootprintBytes),
    readings.map(({ value }) => value.peakPhysicalFootprintBytes),
    bornDuringCapture,
  );
  return {
    pid: first.value.pid,
    processStartId: first.value.processStartId,
    role: first.value.role,
    firstElapsedMs: first.elapsedMs,
    lastElapsedMs: last.elapsedMs,
    samples: readings.length,
    cpuTimeMs: monotonicCpu ? cpu.at(-1)! - (bornDuringCapture ? 0 : cpu[0]!) : null,
    cpuCoverage,
    startedAt: first.value.startedAt ?? null,
    peakResidentBytes: residentPeak.value,
    residentPeakCoverage: residentPeak.coverage,
    lastObservedResidentBytes: last.value.residentBytes,
    settledResidentBytes: settled ? last.value.residentBytes : null,
    peakPhysicalFootprintBytes: footprintPeak.value,
    footprintPeakCoverage: footprintPeak.coverage,
    lastObservedPhysicalFootprintBytes: last.value.physicalFootprintBytes,
    settledPhysicalFootprintBytes: settled ? last.value.physicalFootprintBytes : null,
    peakHeapUsedBytes: maximum(readings.map(({ value }) => value.heapUsedBytes)),
    lastObservedHeapUsedBytes: last.value.heapUsedBytes,
    settledHeapUsedBytes: settled ? last.value.heapUsedBytes : null,
    peakPrivateCommittedBytes: maximum(readings.map(({ value }) => value.privateCommittedBytes)),
    lastObservedPrivateCommittedBytes: last.value.privateCommittedBytes,
    settledPrivateCommittedBytes: settled ? last.value.privateCommittedBytes : null,
  };
};

const processEvidence = (capture: PerformanceCapture, requiredRoles: Role[], operationEndedAt?: number) => {
  const readings = new Map<string, Reading[]>();
  for (const sample of capture.samples) {
    for (const value of sample.processes) {
      const key = JSON.stringify([value.pid, value.processStartId]);
      const entries = readings.get(key) ?? [];
      entries.push({ elapsedMs: sample.elapsedMs, value });
      readings.set(key, entries);
    }
  }
  const processes = [...readings.values()].map((entries) => processSummary(entries, capture, operationEndedAt));
  const failures: string[] = [];
  for (const role of requiredRoles) {
    const matches = processes.filter((process) => process.role === role);
    if (!matches.length) {
      failures.push(`${role} was not measured`);
      continue;
    }
    if (matches.some((process) => process.cpuTimeMs === null)) failures.push(`${role} CPU time was not measured`);
    if (operationEndedAt !== undefined && matches.at(-1)!.settledResidentBytes === null)
      failures.push(`${role} settling memory was not measured`);
    const first = capture.samples.findIndex((sample) => roleExists(sample, role));
    const observed = capture.samples.slice(first);
    if (observed.some((sample) => !sample.processes.some((process) => process.role === role)))
      failures.push(`${role} process readings are missing`);
    const invalidMemory = observed.some((sample) =>
      sample.processes.some(
        (process) => process.role === role && (!Number.isFinite(process.residentBytes) || process.residentBytes <= 0),
      ),
    );
    if (invalidMemory) failures.push(`${role} resident memory was not measured`);
  }
  return { processes, failures };
};

/** Summarize the host's evidence without replacing missing data or joining process lifetimes. */
export const summarizePerformanceEvidence = (
  capture: PerformanceCapture,
  requiredRoles: Role[] = ["backend"],
  operationEndedAt?: number,
) => {
  const failures: string[] = [];
  const { processes, failures: processFailures } = processEvidence(capture, requiredRoles, operationEndedAt);
  const durations: number[] = [];
  let timeouts = 0;
  let unavailable = 0;
  let previous: PerformanceCapture["samples"][number] | undefined;
  if (!capture.samples.length) failures.push("No capture samples were recorded");
  if (capture.droppedSamples > 0) failures.push("Capture history was truncated");
  for (const sample of capture.samples) {
    if (
      previous &&
      (sample.sequence !== previous.sequence + 1 ||
        sample.elapsedMs <= previous.elapsedMs ||
        sample.elapsedMs - previous.elapsedMs > capture.sampleIntervalMs * 1.5)
    ) {
      failures.push("Capture contains a sampling gap");
    }
    previous = sample;
    const { backend } = sample;
    if (backend.state === "reply" && backend.durationMs !== null && Number.isFinite(backend.durationMs)) {
      durations.push(backend.durationMs);
    } else if (backend.state === "timeout") timeouts++;
    else unavailable++;
  }
  durations.sort((left, right) => left - right);
  const percentile = (fraction: number) => durations[Math.ceil(durations.length * fraction) - 1] ?? null;
  if (!durations.length) failures.push("Backend response time was not measured");
  return {
    captureId: capture.id,
    startedAt: capture.startedAt,
    hostVersion: capture.hostVersion,
    platform: capture.platform,
    sampleIntervalMs: capture.sampleIntervalMs,
    settling:
      operationEndedAt === undefined
        ? null
        : {
            operationEndedAt: new Date(operationEndedAt).toISOString(),
            minimumIdleMs: capture.sampleIntervalMs,
          },
    firstElapsedMs: capture.samples[0]?.elapsedMs ?? null,
    lastElapsedMs: capture.samples.at(-1)?.elapsedMs ?? null,
    response: {
      replies: durations.length,
      missedReplies: timeouts + unavailable,
      timeouts,
      unavailable,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      maximumMs: durations.at(-1) ?? null,
    },
    processes,
    failures: [...new Set([...failures, ...processFailures])],
  };
};
