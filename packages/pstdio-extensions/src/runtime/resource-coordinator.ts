import { type ResourceCapacity, readResourceCapacity } from "./resource-capacity";
import { createCpuReservations } from "./resource-cpu-reservations";
import { holdsExtensionAdmission, runWithExtensionAdmission } from "./resource-lease";

export interface ResourceCost {
  cpu: number;
  memory: number;
}

export class ExtensionResourceError extends Error {
  readonly code: "extension_queue_full" | "extension_resource_deadline";
  constructor(code: "extension_queue_full" | "extension_resource_deadline", message: string) {
    super(message);
    this.code = code;
    this.name = "ExtensionResourceError";
  }
}

interface WaitingJob {
  cpuGroup: object;
  owner: string;
  cost: ResourceCost;
  bytes: number;
  queuedAt: number;
  priority: number;
  start: () => void;
  fail: (error: unknown) => void;
}

export const createResourceCoordinator = (
  options: {
    capacity?: () => Promise<ResourceCapacity>;
    maxQueued?: number;
    maxPerOwner?: number;
    maxQueuedBytes?: number;
    waitMs?: number;
    sampleMs?: number;
  } = {},
) => {
  const queue: WaitingJob[] = [];
  const identity = {};
  const cpu = createCpuReservations();
  let runningMemory = 0;
  let queuedBytes = 0;
  let lastOwner: string | undefined;
  let checking = false;
  let stopped = false;
  let wake: ReturnType<typeof setTimeout> | undefined;

  const remove = (job: WaitingJob) => {
    const index = queue.indexOf(job);
    if (index === -1) return false;
    queue.splice(index, 1);
    queuedBytes -= job.bytes;
    return true;
  };
  const scheduleWake = () => {
    if (queue.length && !wake)
      wake = setTimeout(() => {
        wake = undefined;
        void drain();
      }, options.sampleMs ?? 250);
    if (!queue.length && wake) {
      clearTimeout(wake);
      wake = undefined;
    }
  };
  const drain = async () => {
    if (checking || stopped) return;
    checking = true;
    try {
      const capacity = await (options.capacity ?? readResourceCapacity)();
      while (queue.length) {
        const now = Date.now();
        const candidates = queue.filter(
          (job) =>
            capacity.cpu > 0 &&
            cpu.idle(job.cpuGroup) &&
            cpu.total + Math.min(job.cost.cpu, capacity.cpu) <= capacity.cpu &&
            runningMemory + job.cost.memory <= capacity.memory,
        );
        // Aging eventually moves background work ahead of freshly queued interactive work.
        candidates.sort(
          (a, b) =>
            b.priority + Math.floor((now - b.queuedAt) / 1000) - (a.priority + Math.floor((now - a.queuedAt) / 1000)) ||
            Number(a.owner === lastOwner) - Number(b.owner === lastOwner) ||
            a.queuedAt - b.queuedAt,
        );
        const job = candidates[0];
        if (!job) break;
        remove(job);
        // A single-CPU host makes serial progress, including with internally parallel compilers.
        job.cost = { ...job.cost, cpu: Math.min(job.cost.cpu, capacity.cpu) };
        cpu.set(job.cpuGroup, job, job.cost.cpu);
        runningMemory += job.cost.memory;
        lastOwner = job.owner;
        job.start();
      }
    } catch (error) {
      for (const job of [...queue]) {
        remove(job);
        job.fail(error);
      }
    } finally {
      checking = false;
      scheduleWake();
    }
  };

  const acquire = async (
    owner: string,
    cost: ResourceCost,
    signal: AbortSignal | undefined,
    metadata: { bytes?: number; priority?: number; onWaiting?: () => void; cpuGroup?: object } = {},
  ) => {
    signal?.throwIfAborted();
    if (!Number.isFinite(cost.cpu) || cost.cpu <= 0 || !Number.isFinite(cost.memory) || cost.memory < 0)
      throw new Error("Extension resource costs must be finite and nonnegative, with a positive CPU estimate.");
    const bytes = metadata.bytes ?? 0;
    if (!Number.isFinite(bytes) || bytes < 0)
      throw new Error("Extension queue payload estimates must be finite and nonnegative.");
    if (
      stopped ||
      queue.length >= (options.maxQueued ?? 128) ||
      queue.filter((job) => job.owner === owner).length >= (options.maxPerOwner ?? 16) ||
      queuedBytes + bytes > (options.maxQueuedBytes ?? 8 * 1024 ** 2)
    ) {
      throw new ExtensionResourceError(
        "extension_queue_full",
        "Extension work queue is full. Try again after current work completes.",
      );
    }
    let job!: WaitingJob;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      if (remove(job)) {
        job.fail(signal?.reason);
        void drain();
      }
    };
    try {
      await new Promise<void>((resolve, reject) => {
        job = {
          cpuGroup: metadata.cpuGroup ?? {},
          owner,
          cost: { ...cost },
          bytes,
          priority: metadata.priority ?? 0,
          queuedAt: Date.now(),
          start: resolve,
          fail: reject,
        };
        queue.push(job);
        queuedBytes += bytes;
        signal?.addEventListener("abort", abort, { once: true });
        timer = setTimeout(() => {
          if (!remove(job)) return;
          reject(
            new ExtensionResourceError(
              "extension_resource_deadline",
              "Extension work could not fit the available resources before its queue deadline. Free memory or cancel other work and try again.",
            ),
          );
          void drain();
        }, options.waitMs ?? 30_000);
        try {
          metadata.onWaiting?.();
        } catch {
          /* Progress observers do not own queue state. */
        }
        void drain();
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
    let cpuHeld = true;
    let memoryHeld = true;
    const releaseCpu = () => {
      if (!cpuHeld) return;
      cpuHeld = false;
      cpu.set(job.cpuGroup, job, 0);
      void drain();
    };
    return {
      releaseCpu,
      resumeCpu: () => {
        if (cpuHeld || !memoryHeld) return;
        cpuHeld = true;
        cpu.set(job.cpuGroup, job, job.cost.cpu);
      },
      release: () => {
        releaseCpu();
        if (!memoryHeld) return;
        memoryHeld = false;
        runningMemory -= job.cost.memory;
        void drain();
      },
    };
  };
  const run = async <T>(
    owner: string,
    cost: ResourceCost,
    signal: AbortSignal | undefined,
    work: () => Promise<T>,
    metadata: { bytes?: number; priority?: number; onWaiting?: () => void; cpuGroup?: object } = {},
  ) => {
    signal?.throwIfAborted();
    if (holdsExtensionAdmission(identity)) return work();
    const allocation = await acquire(owner, cost, signal, metadata);
    return runWithExtensionAdmission(identity, allocation, async () => {
      signal?.throwIfAborted();
      return work();
    });
  };
  return {
    run,
    refresh: drain,
    snapshot: () => ({ running: { cpu: cpu.total, memory: runningMemory }, queued: queue.length, queuedBytes }),
    dispose: () => {
      stopped = true;
      clearTimeout(wake);
      for (const job of [...queue]) {
        remove(job);
        job.fail(new Error("Extension resource coordinator stopped."));
      }
    },
  };
};

export const extensionResources = createResourceCoordinator();
