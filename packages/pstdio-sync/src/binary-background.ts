import { type BinaryTask, type BinaryTaskResult, InvalidBinaryTask } from "./binary-task-types";

declare const PSTDIO_SYNC_WORKER_ENTRY: string | undefined;
type Task = BinaryTask | (() => Promise<BinaryTask>);
interface Job {
  id: number;
  task: Task;
  resolve: (result: BinaryTaskResult) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  abort: () => void;
}

const capacity = 32;
const queue: Job[] = [];
const room = new Set<() => void>();
let worker: Worker | undefined;
let active: Job | undefined;
let nextId = 0;
let idle: ReturnType<typeof setTimeout> | undefined;
const notifyRoom = () => {
  for (const wake of [...room]) wake();
};
const finish = (job: Job) => {
  job.signal?.removeEventListener("abort", job.abort);
  if (active === job) active = undefined;
  void drain();
};
const failWorker = (instance: Worker, error: Error) => {
  if (worker !== instance) return;
  worker = undefined;
  instance.terminate();
  const job = active;
  if (job) {
    job.reject(error);
    finish(job);
  }
};
const startWorker = () => {
  // Compiled executables register entrypoints by their build input path.
  const entry =
    typeof PSTDIO_SYNC_WORKER_ENTRY === "string" ? PSTDIO_SYNC_WORKER_ENTRY : import.meta.resolve("./binary-worker.ts");
  const instance = new Worker(entry);
  worker = instance;
  instance.onmessage = (event: MessageEvent<{ id: number; result?: BinaryTaskResult; error?: string }>) => {
    const job = active;
    if (worker !== instance || !job || job.id !== event.data.id) return;
    if (event.data.result) job.resolve(event.data.result);
    else job.reject(new InvalidBinaryTask(event.data.error));
    finish(job);
    if (!active)
      idle = setTimeout(() => {
        if (worker !== instance) return;
        worker = undefined;
        instance.terminate();
      }, 0);
  };
  instance.onerror = (event) => failWorker(instance, new Error(event.message));
  instance.addEventListener("close", () => failWorker(instance, new Error("Document worker closed")));
  return instance;
};
const drain = async () => {
  if (active || !queue.length) return;
  clearTimeout(idle);
  const job = queue.shift()!;
  active = job;
  notifyRoom();
  try {
    // Snapshot factories run only after admission, so queued status checks do not
    // fetch and retain a full owner each while waiting for CPU.
    const task = typeof job.task === "function" ? await job.task() : job.task;
    if (active !== job) return;
    (worker ?? startWorker()).postMessage({ id: job.id, task });
  } catch (error) {
    if (active !== job) return;
    job.reject(error);
    finish(job);
  }
};
const waitForRoom = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      room.delete(wake);
      signal?.removeEventListener("abort", abort);
    };
    const wake = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      cleanup();
      reject(signal?.reason);
    };
    room.add(wake);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });

export const runBinaryTask = async (task: Task, signal?: AbortSignal) => {
  while (queue.length >= capacity) await waitForRoom(signal);
  signal?.throwIfAborted();
  return new Promise<BinaryTaskResult>((resolve, reject) => {
    const job: Job = {
      id: ++nextId,
      task,
      resolve,
      reject,
      signal,
      abort: () => {
        if (active === job) {
          const instance = worker;
          worker = undefined;
          instance?.terminate();
          active = undefined;
        } else {
          const index = queue.indexOf(job);
          if (index >= 0) queue.splice(index, 1);
        }
        reject(signal?.reason);
        job.signal?.removeEventListener("abort", job.abort);
        notifyRoom();
        void drain();
      },
    };
    signal?.addEventListener("abort", job.abort, { once: true });
    queue.push(job);
    void drain();
  });
};

export const binaryQueueStatus = () => ({ active: !!active, queued: queue.length, waiting: room.size });
