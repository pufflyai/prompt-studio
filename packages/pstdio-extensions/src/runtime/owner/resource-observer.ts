import { createProcessSampler, type ProcessIdentity, type ProcessReading } from "../process-sampler";
import { ownedProcesses } from "./owned-processes";

const sampleIntervalMs = 250;
interface Observation {
  sampleIntervalMs: number;
  sampledAt: string | null;
  windowMs: number | null;
  /** One fully used CPU core is 1, regardless of the runtime's total CPU capacity. */
  cpuCores: number | null;
  residentBytes: number | null;
  processes: number;
  observations: string[];
}
interface Entry {
  previous: Map<number, { reading: ProcessReading; at: number }>;
  previousAt?: number;
  snapshot: Observation;
}
const empty = (): Observation => ({
  sampleIntervalMs,
  sampledAt: null,
  windowMs: null,
  cpuCores: null,
  residentBytes: null,
  processes: 0,
  observations: ["Waiting for a kernel process sample."],
});

const sampleEntry = async (
  pid: number,
  entry: Entry,
  table: ProcessIdentity[],
  sampler: Awaited<ReturnType<typeof createProcessSampler>>,
) => {
  const owned = ownedProcesses(pid, table);
  const readings = await Promise.all(
    owned.map(async (process) => ({
      pid: process.pid,
      reading: await sampler.read(process.pid),
      at: performance.now(),
    })),
  );
  const current = new Map<number, { reading: ProcessReading; at: number }>();
  const at = performance.now();
  let cpuCores: number | null = 0;
  let residentBytes: number | null = 0;
  const observations: string[] = [];
  for (const { pid, reading, at } of readings) {
    if (!reading) {
      cpuCores = null;
      residentBytes = null;
      observations.push("An owned process exited or its kernel reading was unavailable.");
      continue;
    }
    current.set(pid, { reading, at });
    if (residentBytes !== null) residentBytes += reading.residentBytes;
    const previous = entry.previous.get(pid);
    if (!previous || previous.reading.processStartId !== reading.processStartId || at <= previous.at) cpuCores = null;
    else if (cpuCores !== null)
      cpuCores += Math.max(0, reading.cpuTimeMs - previous.reading.cpuTimeMs) / (at - previous.at);
  }
  if (!owned.length) {
    cpuCores = null;
    residentBytes = null;
    observations.push("The owner is no longer present in the kernel process table.");
  }
  if (cpuCores === null && !observations.length)
    observations.push("CPU measurement needs two samples of the same process identities.");
  entry.snapshot = {
    sampleIntervalMs,
    sampledAt: new Date().toISOString(),
    windowMs: entry.previousAt === undefined ? null : at - entry.previousAt,
    cpuCores,
    residentBytes,
    processes: owned.length,
    observations,
  };
  entry.previous = current;
  entry.previousAt = at;
};

// One process-table scan serves all owners. It keeps only the latest readings,
// never command arguments, process names, environment values or unbounded history.
const createMonitor = () => {
  const entries = new Map<number, Entry>();
  const sampler = createProcessSampler();
  void sampler.catch(() => {});
  let pending: Promise<void> | undefined;
  const sample = () => {
    pending ??= (async () => {
      try {
        const kernel = await sampler;
        const table = await kernel.list();
        await Promise.all([...entries].map(([pid, entry]) => sampleEntry(pid, entry, table, kernel)));
      } catch {
        for (const entry of entries.values()) {
          entry.previous.clear();
          entry.snapshot = {
            ...empty(),
            sampledAt: new Date().toISOString(),
            observations: ["Kernel process observations are unavailable; resource estimates remain in effect."],
          };
        }
      }
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  };
  const timer = setInterval(() => void sample(), sampleIntervalMs);
  timer.unref();
  return {
    register: (pid: number) => {
      const entry: Entry = { previous: new Map(), snapshot: empty() };
      entries.set(pid, entry);
      void sample();
      let closing: Promise<void> | undefined;
      return {
        snapshot: () => entry.snapshot,
        close: () => {
          if (closing) return closing;
          entries.delete(pid);
          closing = Promise.resolve();
          if (entries.size) return closing;
          clearInterval(timer);
          monitor = undefined;
          closing = Promise.resolve(pending)
            .then(async () => {
              (await sampler.catch(() => null))?.close();
            })
            .catch(() => {});
          return closing;
        },
      };
    },
  };
};
let monitor: ReturnType<typeof createMonitor> | undefined;
const observers = new WeakMap<Bun.Subprocess, ReturnType<ReturnType<typeof createMonitor>["register"]>>();

export const observeOwnerProcess = (child: Bun.Subprocess) => {
  monitor ??= createMonitor();
  const observer = monitor.register(child.pid);
  observers.set(child, observer);
  void child.exited.then(() => observer.close());
};
export const readOwnerResources = (child: Bun.Subprocess | undefined) =>
  child ? observers.get(child)?.snapshot() : undefined;
export const closeOwnerResources = (child: Bun.Subprocess) => observers.get(child)?.close();
