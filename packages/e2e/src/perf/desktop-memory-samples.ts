import { execFile, spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import type { KernelProcessReading } from "pstdio-diagnostics";

export const ownedProcessTree = async (
  processes: number[][],
  roots: number[],
  identities: Map<number, string>,
  read: (pid: number) => Promise<KernelProcessReading | null>,
) => {
  const live = new Set(processes.map(([pid]) => pid!));
  const priorReadings = new Map<number, KernelProcessReading | null>();
  const reused = new Set<number>();
  for (const [pid, identity] of identities) {
    if (!live.has(pid)) continue;
    const reading = await read(pid);
    if (reading && reading.processStartId !== identity) {
      reused.add(pid);
    } else priorReadings.set(pid, reading);
  }
  const owned = new Set(roots.filter((pid) => live.has(pid) && !reused.has(pid)));
  for (const pid of identities.keys()) if (live.has(pid) && !reused.has(pid)) owned.add(pid);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const [pid, parent] of processes)
      if (owned.has(parent!) && !owned.has(pid!) && !reused.has(pid!)) {
        owned.add(pid!);
        expanded = true;
      }
  }
  return { live, owned, priorReadings, reused };
};

/** Use the packaged sidecar's kernel sampler, outside the observed app's process tree. */
export const sampleDesktopMemory = (
  sidecar: string,
  roots: () => number[],
  output: string,
  heap?: () => Promise<number>,
) => {
  const observer = spawn(sidecar, ["performance-observer"], { stdio: ["pipe", "pipe", "ignore"] });
  const lines = createInterface({ input: observer.stdout });
  let pending: ReturnType<typeof Promise.withResolvers<KernelProcessReading | null>> | undefined;
  lines.on("line", (line) => {
    const request = pending;
    pending = undefined;
    try {
      request?.resolve(JSON.parse(line));
    } catch (error) {
      request?.reject(error);
    }
  });
  observer.on("error", (error) => pending?.reject(error));
  observer.on("close", () => pending?.reject(new Error("Kernel memory observer exited")));
  const read = (pid: number) => {
    pending = Promise.withResolvers<KernelProcessReading | null>();
    observer.stdin.write(`${pid}\n`);
    return pending.promise;
  };
  let phase = "startup";
  let stopped = false;
  const identities = new Map<number, string>();
  const samples: {
    at: number;
    phase: string;
    total: number | null;
    count: number;
    rss: number | null;
    heap: number | null;
    cycle: number;
  }[] = [];
  let cycle = 0;
  let measuredAt = 0;
  let measuredUntil = 0;
  const sample = async () => {
    const at = performance.now();
    const { stdout } = await promisify(execFile)("ps", ["-axo", "pid=,ppid="]);
    const processes = stdout
      .trim()
      .split("\n")
      .map((line) => line.trim().split(/\s+/).map(Number));
    // Validate remembered parents before expanding their branches; a rejected parent
    // cannot introduce unrelated descendants into the retained ownership set.
    const { owned, priorReadings, reused } = await ownedProcessTree(processes, roots(), identities, read);
    const readings: { pid: number; reading: KernelProcessReading | null }[] = [];
    for (const pid of owned) {
      const reading = priorReadings.has(pid) ? priorReadings.get(pid)! : await read(pid);
      if (reading) identities.set(pid, reading.processStartId);
      readings.push({ pid, reading });
    }
    // Keep each original generation for this bounded capture, including after exit.
    // A static root PID must never acquire an unrelated replacement on a later sample.
    const complete =
      reused.size === 0 &&
      readings.length > 0 &&
      readings.every(({ reading }) => reading?.physicalFootprintBytes != null);
    const total = complete ? readings.reduce((sum, { reading }) => sum + reading!.physicalFootprintBytes!, 0) : null;
    const rss =
      readings.length && readings.every(({ reading }) => reading?.residentBytes != null)
        ? readings.reduce((sum, { reading }) => sum + reading!.residentBytes!, 0)
        : null;
    const sample = { at, phase, total, count: readings.length, rss, heap: heap ? await heap() : null, cycle };
    samples.push(sample);
    appendFileSync(
      output,
      `${JSON.stringify({ ...sample, elapsedMs: performance.now() - at, readings, reusedPids: [...reused] })}\n`,
    );
  };
  // Half-second spacing leaves room for enumeration and retains at least one sample per second.
  const running = (async () => {
    while (!stopped) {
      const start = performance.now();
      await sample();
      await new Promise((done) => setTimeout(done, Math.max(0, 500 - (performance.now() - start))));
    }
  })();
  // Keep a rejected sampling loop observed while the workload unwinds.
  void running.catch(() => {});
  return {
    phase: (value: string) => {
      if (value === "measure") measuredAt = performance.now();
      if (phase === "measure" && value !== phase) measuredUntil = performance.now();
      phase = value;
    },
    cycle: (value: number) => {
      cycle = value;
    },
    close: async () => {
      stopped = true;
      try {
        await running;
      } finally {
        lines.close();
        identities.clear();
        observer.stdin.end();
        if (observer.exitCode === null) await new Promise<void>((done) => observer.once("close", () => done()));
      }
      let weighted = 0,
        durationMs = 0,
        missingMs = 0;
      const measured = samples.filter((sample) => sample.phase === "measure");
      for (let index = 0; index + 1 < samples.length; index++) {
        const current = samples[index]!,
          next = samples[index + 1]!;
        const duration = Math.max(0, Math.min(next.at, measuredUntil) - Math.max(current.at, measuredAt));
        if (!duration) continue;
        if (current.total === null) missingMs += duration;
        else {
          weighted += current.total * duration;
          durationMs += duration;
        }
      }
      return {
        metric: "macOS physical footprint including compressed memory",
        averageBytes: durationMs ? weighted / durationMs : null,
        durationMs,
        missingMs,
        measuredSamples: measured.length,
        missingSamples: measured.filter((sample) => sample.total === null).length,
        maximumGapMs: Math.max(0, ...measured.slice(1).map((sample, index) => sample.at - measured[index]!.at)),
        startupPeakBytes: Math.max(
          0,
          ...samples.filter((sample) => sample.phase !== "measure").map((sample) => sample.total ?? 0),
        ),
        measuredPeakBytes: Math.max(0, ...measured.map((sample) => sample.total ?? 0)),
        finalBytes: measured.at(-1)?.total,
        maximumProcessCount: Math.max(0, ...measured.map((sample) => sample.count)),
        rssPeakBytes: measured.some((sample) => sample.rss === null)
          ? null
          : Math.max(...measured.map((sample) => sample.rss!)),
        heapPeakBytes: measured.some((sample) => sample.heap === null || !Number.isFinite(sample.heap))
          ? null
          : Math.max(...measured.map((sample) => sample.heap!)),
        cycles: [...new Set(measured.map((sample) => sample.cycle))].map((cycle) => ({
          cycle,
          retainedBytes: measured.findLast((sample) => sample.cycle === cycle)?.total,
        })),
      };
    },
  };
};
