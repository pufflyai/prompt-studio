import { randomUUID } from "node:crypto";
import type {
  PerformanceCapture,
  PerformanceCaptureSample,
  PerformanceProcessSample,
} from "pstdio-api-contracts/performance-diagnostics";
import { measureBackendResponse, type PerformanceBackend } from "./backend-response";

export type KernelProcessReading = Pick<
  PerformanceProcessSample,
  | "processStartId"
  | "cpuTimeMs"
  | "residentBytes"
  | "peakResidentBytes"
  | "physicalFootprintBytes"
  | "peakPhysicalFootprintBytes"
  | "privateCommittedBytes"
>;

interface CaptureOptions {
  hostVersion: string;
  platform: string;
  intervalMs: number;
  backend: () => PerformanceBackend | null;
  readProcess: (pid: number, signal: AbortSignal) => Promise<KernelProcessReading | null>;
  record?: (sample: PerformanceCaptureSample) => void;
  now?: () => number;
}

const LIVE_SAMPLES = 150;
const LIVE_BYTES = 512 * 1024;

export class DesktopPerformanceCapture {
  readonly #options: CaptureOptions;
  readonly #abort = new AbortController();
  readonly #id = randomUUID();
  readonly #startedAt = new Date().toISOString();
  readonly #started: number;
  #samples: { value: PerformanceCaptureSample; bytes: number }[] = [];
  #bytes = 0;
  #sequence = 0;
  #pending: Promise<void> | null = null;
  #previous: { pid: number; reading: KernelProcessReading; at: number } | null = null;
  #lastSampleAt: number | null = null;

  constructor(options: CaptureOptions) {
    this.#options = options;
    this.#started = this.#now();
  }

  get id() {
    return this.#id;
  }

  #now() {
    return this.#options.now?.() ?? performance.now();
  }

  snapshot(): PerformanceCapture {
    return {
      version: 2,
      id: this.#id,
      startedAt: this.#startedAt,
      hostVersion: this.#options.hostVersion,
      platform: this.#options.platform,
      sampleIntervalMs: this.#options.intervalMs,
      samples: this.#samples.map((entry) => entry.value),
      droppedSamples: this.#sequence - this.#samples.length,
    };
  }

  stop() {
    this.#abort.abort();
    this.#samples = [];
    this.#bytes = 0;
    this.#previous = null;
    this.#lastSampleAt = null;
  }

  sample(processes: PerformanceProcessSample[]) {
    if (this.#abort.signal.aborted) return Promise.resolve();
    if (this.#pending) return this.#pending;
    this.#pending = this.#sample(processes).finally(() => {
      this.#pending = null;
    });
    return this.#pending;
  }

  #record(sample: PerformanceCaptureSample) {
    const bytes = Buffer.byteLength(JSON.stringify(sample));
    if (bytes > LIVE_BYTES) throw new Error("Performance sample exceeds the capture bound");
    this.#samples.push({ value: sample, bytes });
    this.#bytes += bytes;
    while (this.#samples.length > LIVE_SAMPLES || this.#bytes > LIVE_BYTES) this.#bytes -= this.#samples.shift()!.bytes;
    this.#options.record?.(sample);
  }

  async #sample(processes: PerformanceProcessSample[]) {
    const { signal } = this.#abort;
    const backend = this.#options.backend();
    const sampledAt = this.#now();
    const capturedAt = new Date().toISOString();
    const [reading, response] = await Promise.all([
      backend?.scope === "local" && backend.pid !== null
        ? this.#options.readProcess(backend.pid, signal).catch(() => null)
        : null,
      measureBackendResponse(backend, signal, this.#options.intervalMs).catch(() => null),
    ]);
    if (signal.aborted || !response) return;
    if (reading && backend?.pid !== null && backend?.pid !== undefined) {
      const previous = this.#previous;
      const sameProcess = previous?.pid === backend.pid && previous.reading.processStartId === reading.processStartId;
      const interval = previous ? sampledAt - previous.at : 0;
      let cpuPercent: number | null = null;
      if (sameProcess && interval > 0 && reading.cpuTimeMs !== null && previous.reading.cpuTimeMs !== null) {
        cpuPercent = Math.max(0, ((reading.cpuTimeMs - previous.reading.cpuTimeMs) / interval) * 100);
      }
      processes = [
        ...processes,
        {
          ...reading,
          pid: backend.pid,
          role: "backend",
          cpuPercent,
          heapUsedBytes: response.runtime?.pid === backend.pid ? response.runtime.heapUsedBytes : null,
          externalBytes: response.runtime?.pid === backend.pid ? response.runtime.externalBytes : null,
        },
      ];
      this.#previous = { pid: backend.pid, reading, at: sampledAt };
    } else {
      this.#previous = null;
    }
    const sample: PerformanceCaptureSample = {
      sequence: this.#sequence++,
      capturedAt,
      elapsedMs: sampledAt - this.#started,
      intervalMs: this.#lastSampleAt === null ? null : sampledAt - this.#lastSampleAt,
      processes,
      backend: response,
    };
    this.#lastSampleAt = sampledAt;
    this.#record(sample);
  }
}
