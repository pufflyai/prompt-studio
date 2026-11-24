import { preparationIncludes } from "./preparation-priority";
import {
  activePreparationPriority,
  createYieldClock,
  type Job,
  preparationResourcesOverlap,
  yieldPreparation,
} from "./preparation-queue";
import type { createPreparationWorkerSlots, PreparationWorkerSlot } from "./preparation-worker-slot";

type PreparationPool = ReturnType<typeof createPreparationWorkerSlots>;
type PreparationAdmission = {
  idle: (job: Job) => boolean;
  priority: (job: Job) => number;
  eligible: (job: Job) => boolean;
};

export const preparationStartingReservation = ({ active, ready, worker }: PreparationWorkerSlot) =>
  worker && !ready ? active : undefined;

const preparationJobsConflict = (left: Job, right: Job) => {
  const a = left.resources;
  const b = right.resources;
  return !a || !b || a.some((key) => b.some((other) => preparationResourcesOverlap(key, other)));
};

export const preparationSlotCompatible = (
  pool: PreparationPool,
  job: Job,
  slot: PreparationWorkerSlot,
  releasing: readonly PreparationWorkerSlot[] = [],
) => {
  if (!job.resources && slot.index !== 0) return false;
  return pool.slots.every((other) => {
    if (other === slot || releasing.includes(other)) return true;
    const owner = other.dispatched ? other.active : (preparationStartingReservation(other) ?? other.retiring);
    return !owner || !preparationJobsConflict(job, owner);
  });
};

const hasPreparationCapacityAfter = (pool: PreparationPool, job: Job, releasing: readonly PreparationWorkerSlot[]) => {
  const placed = pool.slots.find((slot) => slot.active === job);
  return pool.slots.some(
    (slot) =>
      (!placed || placed === slot) &&
      (releasing.includes(slot) || (!slot.restarting && !slot.dispatched && !preparationStartingReservation(slot))) &&
      preparationSlotCompatible(pool, job, slot, releasing),
  );
};

export const hasIdlePreparationSlot = (pool: PreparationPool, job: Job) => hasPreparationCapacityAfter(pool, job, []);

// A slot waiting for build admission retires a less urgent build holder, which then yields like any other.
export const preemptPreparationBuildBlockers = (pool: PreparationPool, queuedPriority: (job: Job) => number) => {
  for (const waiting of pool.slots) {
    if (!waiting.dispatched || !waiting.active || !waiting.waitingBuilds) continue;
    for (const holder of pool.slots)
      if (
        holder !== waiting &&
        holder.dispatched &&
        holder.active &&
        holder.activeBuilds &&
        activePreparationPriority(waiting.active, queuedPriority) <
          activePreparationPriority(holder.active, queuedPriority)
      )
        pool.replace(holder, yieldPreparation(holder.active, waiting.active));
  }
};

// A held job's preemptor is busy while its work runs or has capacity reserved on a starting worker.
// The exact job it retired a slot for also counts while that slot restores capacity: during replacement,
// across a factory swap or worker error, and while another job occupies it once ready. This credit ends
// when the job leaves the queue, the slot is ready and holds nothing else, or another compatible slot is idle.
// A queued job, including one reserved on a starting worker, earns no busy time if admission is closed
// or a live restoration is barred by a job held for its owner. The bounded fallback breaks that cycle.
// Eligibility here never uses the yield clock, so deriving busy owners cannot re-enter it.
export const createPoolYieldClock = (
  pool: PreparationPool,
  pending: () => Job[],
  waits: PreparationAdmission,
  resume: () => void,
) => {
  const credits = new Map<PreparationWorkerSlot, Job>();
  const restoring = (job: Job) =>
    [...job.waiters].some(
      ({ scope }) => scope?.continuation?.continuing && scope.continuation.priority === "restoration",
    );
  // A restoration waiting on a job that this preemptor keeps out of the queue.
  const restorationCycle = (job: Job, waiting: ReadonlySet<Job>) =>
    [...waiting].some(
      (held) =>
        held !== job &&
        held.yielded?.size &&
        restoring(held) &&
        Number.isFinite(waits.priority(held)) &&
        !waits.eligible(held) &&
        [...held.yielded.keys()].some(
          (owner) => owner.continuing && [...job.waiters].some((waiter) => preparationIncludes(waiter.scope, owner)),
        ),
    );
  const clock = createYieldClock(() => {
    const waiting = new Set(pending());
    const admitted = (job: Job) =>
      Number.isFinite(waits.priority(job)) && (waits.eligible(job) || !restorationCycle(job, waiting));
    const busy = pool.slots.map((slot) => {
      if (slot.dispatched) return slot.active;
      const reservation = preparationStartingReservation(slot);
      return reservation && admitted(reservation) ? reservation : undefined;
    });

    for (const [slot, job] of credits)
      if (!waiting.has(job) || (slot.ready && (!slot.active || slot.active === job))) credits.delete(slot);
      // Between its restart and the next pump the slot briefly has no worker and holds no capacity.
      else if ((slot.restarting || slot.worker) && !waits.idle(job) && admitted(job)) busy.push(job);
    return busy;
  }, resume);
  const yieldTo = (slot: PreparationWorkerSlot, next: Job) => {
    credits.set(slot, next);
    pool.replace(slot, yieldPreparation(slot.active!, next));
  };
  return { clock, yieldTo };
};

const preparationPreemptionSlots = (pool: PreparationPool, job: Job, queuedPriority: (job: Job) => number) => {
  const running = pool.slots.filter((slot) => slot.dispatched && slot.active);
  const blockers = running.filter((slot) => preparationJobsConflict(job, slot.active!));
  // Only unplaced work can use a disjoint slot after retiring its worker.
  if (blockers.length || pool.slots.some((slot) => slot.active === job)) return blockers;
  return running
    .reverse()
    .sort(
      (a, b) =>
        activePreparationPriority(b.active!, queuedPriority) - activePreparationPriority(a.active!, queuedPriority),
    )
    .slice(0, 1);
};

// Stop at the first admission that can actually retire a lower-priority blocker.
// A starting worker reserves capacity for its job. An exclusive job still bars
// jobs behind it, regardless of its own admission or reservation.
export const preparationPreemptionTarget = (pool: PreparationPool, pending: Job[], waits: PreparationAdmission) => {
  for (const job of pending) {
    const starting = pool.slots.some((slot) => preparationStartingReservation(slot) === job);
    if (!starting && waits.eligible(job) && !waits.idle(job)) {
      const priority = waits.priority(job);
      const slots = preparationPreemptionSlots(pool, job, waits.priority).filter(
        (slot) => priority < activePreparationPriority(slot.active!, waits.priority),
      );
      // Starting and retiring owners still hold resources. Retire only when this set can make room.
      if (slots.length && hasPreparationCapacityAfter(pool, job, slots)) return { job, slots };
    }
    if (!job.resources) return;
  }
};
