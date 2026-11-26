import {
  type createPreparationContinuations,
  liveContinuations,
  preparationIncludes,
  type preparationPriority,
  preparationRequestedBy,
} from "./preparation-priority";

export interface PreparationOptions {
  /** Explicit disjoint resource paths allow parallel execution. Ancestors conflict; unknown work is exclusive. */
  resources?: readonly string[];
  signal?: AbortSignal;
  priority?: "requested" | "background";
  key?: string;
  home?: string;
  /** Status inspection yields to live continuations but can interrupt unreserved speculation. */
  preserveActiveContinuation?: boolean;
}
type Continuation = NonNullable<ReturnType<typeof preparationPriority.getStore>>;
export const priorityFor = (options: PreparationOptions, scope?: Continuation, owner?: Continuation) => {
  const continuation = owner ?? scope?.continuation;
  // A primary-worker loss must restore watches before an unrelated speculative
  // peer resumes. Ordinary background continuations still never gain this rank.
  if (continuation?.continuing && continuation.priority === "restoration") return 1;
  if (options.priority === "background") return 2;
  const requested = owner ? preparationRequestedBy(scope, owner) : !scope || scope.priority === "requested";
  if (options.priority === "requested" || requested) return 0;
  return continuation?.continuing && continuation.priority === "requested" ? 1 : 2;
};
export interface Waiter {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  removeAbort: () => void;
  priority: (owner?: Continuation) => number;
  preserveActiveContinuation?: boolean;
  scope?: ReturnType<typeof preparationPriority.getStore>;
}
export interface Job {
  resources?: readonly string[];
  id: number;
  key: string;
  task: string;
  input: unknown;
  home: string;
  env: NodeJS.ProcessEnv;
  waiters: Set<Waiter>;
  /** Live continuations this job's worker was retired for, with when each owner went idle. */
  yielded?: Map<Continuation, { idleSince?: number }>;
}
// These jobs read live inputs and only write into unique immutable generations.
// An install may change arbitrary dependency paths, so reads share slots only with other reads.
export const readsRevisionInputs = (job: Job) => job.task === "runtime.prepare" || job.task === "runtime.key";
export const needsExclusivePreparation = (job: Job) => !job.resources && !readsRevisionInputs(job);
export const createJob = (
  id: number,
  key: string,
  task: string,
  input: unknown,
  home: string,
  resources?: readonly string[],
) => ({
  resources,
  id,
  key,
  task,
  input,
  home,
  env: { ...process.env },
  waiters: new Set<Waiter>(),
});
export const settlePreparationJob = (jobs: Map<string, Job>, job: Job, error: unknown, value?: unknown) => {
  if (jobs.get(job.key) === job) jobs.delete(job.key);
  for (const waiter of job.waiters) {
    waiter.removeAbort();
    if (error) waiter.reject(error);
    else waiter.resolve(value);
  }
  job.waiters.clear();
};

export const preparationJobMessage = (active: Job) => ({
  kind: "run",
  id: active.id,
  task: active.task,
  input: active.input,
  home: active.home,
  env: active.env,
});

const waiterPriority = (waiter: Waiter, owner?: Continuation) => {
  if (!owner) return waiter.priority();
  return preparationIncludes(waiter.scope, owner) ? Math.max(waiter.priority(), waiter.priority(owner)) : Infinity;
};

export const preparationQueuePriority =
  (continuations: ReturnType<typeof createPreparationContinuations>) => (job: Job, owner?: Continuation) =>
    Math.min(
      ...[...job.waiters].map((waiter) =>
        waiter.preserveActiveContinuation && continuations.hasUrgentOtherThan(waiter.scope?.continuation)
          ? Infinity
          : waiterPriority(waiter, owner),
      ),
    );
export type PreparationJobPriority = ReturnType<typeof preparationQueuePriority>;

// Retiring a worker for a continuation's job resumes the interrupted job after that
// continuation, not in its next database gap, where its next job would retire it again.
/**
 * How long an interrupted job stays out of its preemptor's gaps while that preemptor is idle. It is busy
 * only while one of its jobs runs or is reserved on a starting worker, or while the job it retired a slot
 * for still waits for that slot's capacity. Other queued work leaves the clock running, so a barred job
 * cannot extend the hold.
 * A long step of its own never spends the hold, and a waiter that reaches the job without a loan is
 * delayed at most this long once the preemptor stops running work.
 */
export const PREPARATION_YIELD_HOLD_MS = 1_000;

/** Tells the queue whether a continuation still has work, and when to look at a held job again. */
export interface YieldClock {
  busy: (owner: Continuation) => boolean;
  now: () => number;
  wake: (delay: number) => void;
}

export const createYieldClock = (jobs: () => Iterable<Job | undefined>, resume: () => void): YieldClock => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let wakeAt = Number.POSITIVE_INFINITY;
  const now = () => performance.now();
  return {
    busy: (owner) =>
      [...jobs()].some((job) => job && [...job.waiters].some((waiter) => preparationIncludes(waiter.scope, owner))),
    now,
    wake: (delay) => {
      if (timer && now() + delay >= wakeAt) return;
      clearTimeout(timer);
      wakeAt = now() + delay;
      timer = setTimeout(() => {
        timer = undefined;
        wakeAt = Number.POSITIVE_INFINITY;
        resume();
      }, delay + 1);
      timer.unref?.();
    },
  };
};

export const yieldPreparation = (
  job: Job,
  next: Job,
  queuedPriority: PreparationJobPriority,
  preemptingPriority = queuedPriority,
) => {
  const interruptedPriority = activePreparationPriority(job, queuedPriority);
  const owners = new Set([...next.waiters].flatMap(({ scope }) => liveContinuations(scope)));
  // A shared job can borrow its rank from one caller without lending it to the others.
  for (const owner of owners) {
    if (!owner.continuing || preemptingPriority(next, owner) >= interruptedPriority) continue;
    job.yielded ??= new Map();
    job.yielded.set(owner, {});
  }
  return job;
};
const holds = (owner: Continuation, hold: { idleSince?: number }, clock: YieldClock) => {
  if (clock.busy(owner)) {
    hold.idleSince = undefined;
    return true;
  }
  const now = clock.now();
  hold.idleSince ??= now;
  const left = hold.idleSince + PREPARATION_YIELD_HOLD_MS - now;
  if (left > 0) clock.wake(left);
  return left > 0;
};
const awaitsYield = (job: Job, clock?: YieldClock) => {
  if (!job.yielded) return false;
  for (const [owner, hold] of job.yielded)
    if (!owner.continuing || (clock && !holds(owner, hold, clock))) job.yielded.delete(owner);
  // A continuation that now waits on the interrupted job itself, directly or through a loan, needs it to run.
  // Membership is exact: a lent continuation still counts when a more urgent one ranks first.
  return (
    job.yielded.size > 0 &&
    ![...job.waiters].some((waiter) =>
      [...job.yielded!.keys()].some((owner) => preparationIncludes(waiter.scope, owner)),
    )
  );
};

/** Re-reads every hold whenever work starts or ends, so idle time counts only between the owner's jobs. */
export const refreshYieldHolds = (jobs: Iterable<Job>, clock: YieldClock) => {
  for (const job of jobs) awaitsYield(job, clock);
};

export const orderPreparationQueue = (
  queued: Job[],
  priority: (job: Job) => number,
  continuations: ReturnType<typeof createPreparationContinuations>,
  clock?: YieldClock,
) => {
  queued.sort((a, b) => priority(a) - priority(b) || a.id - b.id);
  if (queued[0] && !Number.isFinite(priority(queued[0]))) return false;
  // A live continuation owns its database/callback gaps as well as worker jobs.
  if (queued[0] && priority(queued[0]) > 0 && continuations.size) {
    const dependency = queued.findIndex(
      (job) =>
        Number.isFinite(priority(job)) &&
        !awaitsYield(job, clock) &&
        [...job.waiters].some(
          (waiter) =>
            waiter.scope?.continuation?.continuing &&
            (!continuations.restoring || waiter.scope.continuation.priority === "restoration"),
        ),
    );
    if (dependency < 0) return false;
    queued.unshift(...queued.splice(dependency, 1));
  }
  return true;
};

// Closing admission affects queued reads. An already running read keeps its
// urgency until it replies, rather than becoming infinitely preemptible.
export const activePreparationPriority = (job: Job, queuedPriority: PreparationJobPriority, owner?: Continuation) => {
  const priority = queuedPriority(job);
  if (Number.isFinite(priority)) return owner ? queuedPriority(job, owner) : priority;
  return Math.min(...[...job.waiters].map((waiter) => waiterPriority(waiter, owner)));
};

export const cancelQueuedPreparation = (jobs: Map<string, Job>, queued: Job[], job: Job) => {
  if (jobs.get(job.key) === job) jobs.delete(job.key);
  const index = queued.indexOf(job);
  if (index >= 0) queued.splice(index, 1);
};

export const waitForPreparation = (
  job: Job,
  options: PreparationOptions,
  scope: ReturnType<typeof preparationPriority.getStore>,
  request: () => void,
  cancel: () => void | Promise<void>,
) => {
  scope?.jobs.add(request);
  const result = new Promise<unknown>((resolve, reject) => {
    const abort = () => {
      job.waiters.delete(waiter);
      waiter.removeAbort();
      if (job.waiters.size) {
        reject(options.signal!.reason);
        request();
      } else {
        try {
          Promise.resolve(cancel()).then(() => reject(options.signal!.reason), reject);
        } catch (error) {
          reject(error);
        }
      }
    };
    const waiter: Waiter = {
      resolve,
      reject,
      scope,
      preserveActiveContinuation: options.preserveActiveContinuation,
      priority: (owner) => priorityFor(options, scope, owner),
      removeAbort: () => options.signal?.removeEventListener("abort", abort),
    };
    job.waiters.add(waiter);
    options.signal?.addEventListener("abort", abort, { once: true });
  });
  return result.finally(() => scope?.jobs.delete(request));
};

export const preparationResourcesOverlap = (left: string, right: string) =>
  left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
