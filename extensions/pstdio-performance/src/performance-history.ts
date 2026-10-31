import type { PerformanceCaptureSample, PerformanceProcessSample, PerformanceSnapshot } from "@pstdio/sdk/extensions";

// Charts show the same 30 seconds as the frame-rate bars at the 2-second capture interval.
export const HISTORY_SAMPLES = 15;

export type MemoryKind = "footprint" | "private" | "resident";

export interface ProcessPoint {
  capturedAt: string;
  cpuPercent: number | null;
  memoryBytes: number | null;
  memoryKind: MemoryKind | null;
  peakMemoryBytes: number | null;
  restarted: boolean;
}

export interface ResponsePoint {
  capturedAt: string;
  // A timeout or refused request has no response time; it is counted as a missed reply instead.
  durationMs: number | null;
  missed: boolean;
}

export type ConnectionState = "connected" | "reconnecting" | "unavailable";

// macOS footprint includes compressed memory and Windows private memory excludes shared pages,
// so either describes the process better than its resident set.
const memoryOf = (process: PerformanceProcessSample) => {
  if (process.physicalFootprintBytes !== null)
    return {
      bytes: process.physicalFootprintBytes,
      kind: "footprint" as const,
      peak: process.peakPhysicalFootprintBytes,
    };
  if (process.privateCommittedBytes !== null)
    return { bytes: process.privateCommittedBytes, kind: "private" as const, peak: null };
  return { bytes: process.residentBytes, kind: "resident" as const, peak: process.peakResidentBytes };
};

const processPoints = (
  samples: { capturedAt: string; processes: PerformanceProcessSample[] }[],
  role: PerformanceProcessSample["role"],
) => {
  let startId: string | undefined;
  return samples.map((sample): ProcessPoint => {
    const process = sample.processes.find((candidate) => candidate.role === role);
    if (!process)
      return {
        capturedAt: sample.capturedAt,
        cpuPercent: null,
        memoryBytes: null,
        memoryKind: null,
        peakMemoryBytes: null,
        restarted: false,
      };
    const restarted = startId !== undefined && startId !== process.processStartId;
    startId = process.processStartId;
    const memory = memoryOf(process);
    return {
      capturedAt: sample.capturedAt,
      cpuPercent: process.cpuPercent,
      memoryBytes: memory.bytes,
      memoryKind: memory.kind,
      peakMemoryBytes: memory.peak,
      restarted,
    };
  });
};

type BackendReading = PerformanceCaptureSample["backend"];

// A backend the host knows how to reach either replies or misses; one it cannot reach is unavailable.
const missedReply = (backend: BackendReading) => backend.state !== "reply" && backend.scope !== "unavailable";

const connectionOf = (latest: BackendReading | undefined): ConnectionState => {
  if (latest?.state === "reply") return "connected";
  return latest && missedReply(latest) ? "reconnecting" : "unavailable";
};

export const performanceHistory = (snapshot: PerformanceSnapshot | null | undefined) => {
  const samples = snapshot?.version === 2 ? snapshot.capture.samples.slice(-HISTORY_SAMPLES) : [];
  const response = samples.map(
    (sample): ResponsePoint => ({
      capturedAt: sample.capturedAt,
      durationMs: sample.backend.state === "reply" ? sample.backend.durationMs : null,
      missed: missedReply(sample.backend),
    }),
  );
  const replies = response.flatMap((point) => (point.durationMs === null ? [] : [point.durationMs]));
  return {
    response,
    responseSummary: {
      averageMs:
        replies.length > 0 ? Math.round(replies.reduce((sum, value) => sum + value, 0) / replies.length) : null,
      maxMs: replies.length > 0 ? Math.max(...replies) : null,
      missed: response.filter((point) => point.missed).length,
    },
    remote: samples.at(-1)?.backend.scope === "remote",
    connection: connectionOf(samples.at(-1)?.backend),
    backend: processPoints(samples, "backend"),
    workbench: processPoints(samples, "workbench"),
  };
};

export type PerformanceHistory = ReturnType<typeof performanceHistory>;
