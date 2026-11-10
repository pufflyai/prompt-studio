import type { createPreparationContinuations, preparationPriority } from "./preparation-priority";

export interface PreparationOptions {
  signal?: AbortSignal;
  priority?: "requested" | "background";
  key?: string;
  home?: string;
  /** Status inspection yields to live continuations but can interrupt unreserved speculation. */
  preserveActiveContinuation?: boolean;
}
export const priorityFor = (options: PreparationOptions, scope: ReturnType<typeof preparationPriority.getStore>) => {
  if (options.priority === "background") return 2;
  const priority = options.priority ?? scope?.priority;
  if (priority === undefined || priority === "requested") return 0;
  return scope?.continuation?.continuing && scope.continuation.priority === "requested" ? 1 : 2;
};
export interface Waiter {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  removeAbort: () => void;
  priority: () => number;
  preserveActiveContinuation?: boolean;
  scope?: ReturnType<typeof preparationPriority.getStore>;
}
export interface Job {
  id: number;
  key: string;
  task: string;
  input: unknown;
  home: string;
  env: NodeJS.ProcessEnv;
  waiters: Set<Waiter>;
}
export const createJob = (id: number, key: string, task: string, input: unknown, home: string) => ({
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

export const preparationQueuePriority =
  (continuations: ReturnType<typeof createPreparationContinuations>) => (job: Job) =>
    Math.min(
      ...[...job.waiters].map((waiter) =>
        waiter.preserveActiveContinuation && continuations.hasUrgentOtherThan(waiter.scope?.continuation)
          ? Infinity
          : waiter.priority(),
      ),
    );

export const orderPreparationQueue = (
  queued: Job[],
  priority: (job: Job) => number,
  continuations: ReturnType<typeof createPreparationContinuations>,
) => {
  queued.sort((a, b) => priority(a) - priority(b) || a.id - b.id);
  if (queued[0] && !Number.isFinite(priority(queued[0]))) return false;
  // A live continuation owns its database/callback gaps as well as worker jobs.
  if (queued[0] && priority(queued[0]) > 0 && continuations.size) {
    const dependency = queued.findIndex(
      (job) =>
        Number.isFinite(priority(job)) &&
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
export const activePreparationPriority = (job: Job, queuedPriority: (job: Job) => number) => {
  const priority = queuedPriority(job);
  return Number.isFinite(priority) ? priority : Math.min(...[...job.waiters].map((waiter) => waiter.priority()));
};
