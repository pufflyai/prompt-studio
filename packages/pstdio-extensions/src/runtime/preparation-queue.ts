import type { createPreparationContinuations, preparationPriority } from "./preparation-priority";

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
export const priorityFor = (options: PreparationOptions, scope: ReturnType<typeof preparationPriority.getStore>) => {
  // A primary-worker loss must restore watches before an unrelated speculative
  // peer resumes. Ordinary background continuations still never gain this rank.
  if (scope?.continuation?.continuing && scope.continuation.priority === "restoration") return 1;
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
type Continuation = NonNullable<Waiter["scope"]>;
export interface Job {
  resources?: readonly string[];
  id: number;
  key: string;
  task: string;
  input: unknown;
  home: string;
  env: NodeJS.ProcessEnv;
  waiters: Set<Waiter>;
  /** Live continuations this job's worker was retired for. */
  yielded?: Set<Continuation>;
}
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

export const preparationQueuePriority =
  (continuations: ReturnType<typeof createPreparationContinuations>) => (job: Job) =>
    Math.min(
      ...[...job.waiters].map((waiter) =>
        waiter.preserveActiveContinuation && continuations.hasUrgentOtherThan(waiter.scope?.continuation)
          ? Infinity
          : waiter.priority(),
      ),
    );

// Retiring a worker for a continuation's job resumes the interrupted job after that
// continuation, not in its next database gap, where its next job would retire it again.
export const yieldPreparation = (job: Job, next: Job) => {
  for (const waiter of next.waiters) {
    const owner = waiter.scope?.continuation;
    if (!owner?.continuing) continue;
    job.yielded ??= new Set();
    job.yielded.add(owner);
  }
  return job;
};
const awaitsYield = (job: Job) => {
  if (!job.yielded) return false;
  for (const owner of job.yielded) if (!owner.continuing) job.yielded.delete(owner);
  // A continuation that now waits on the interrupted job itself needs it to run.
  return (
    job.yielded.size > 0 &&
    ![...job.waiters].some((waiter) => waiter.scope?.continuation && job.yielded!.has(waiter.scope.continuation))
  );
};

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
        !awaitsYield(job) &&
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
      priority: () => priorityFor(options, scope),
      removeAbort: () => options.signal?.removeEventListener("abort", abort),
    };
    job.waiters.add(waiter);
    options.signal?.addEventListener("abort", abort, { once: true });
  });
  return result.finally(() => scope?.jobs.delete(request));
};

export const preparationResourcesOverlap = (left: string, right: string) =>
  left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
