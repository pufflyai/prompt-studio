export interface RendererReadRequest<T> {
  queryKey: string;
  load(signal: AbortSignal): Promise<T> | T;
  onValue(value: T): void;
  onError(error: unknown): void;
}

interface ReadJob {
  token: symbol;
  generation: number;
  queryKey: string;
  run(signal: AbortSignal): Promise<void>;
  onError(error: unknown): void;
}

interface ReadOwner {
  binding?: symbol;
  queryKey?: string;
  generation: number;
  pending?: ReadJob;
  active?: { controller: AbortController; settled: Promise<void> };
  queued: boolean;
}

export interface RendererReadBinding {
  request<T>(request: RendererReadRequest<T>, reason?: "refresh" | "retry"): void;
  dispose(): void;
}

export interface RendererReadRegistry {
  bind(key: string): RendererReadBinding;
  dispose(): Promise<void>;
}

export const createRendererReadRegistry = (options: { deadlineMs?: number } = {}): RendererReadRegistry => {
  const owners = new Map<string, ReadOwner>();
  let disposed = false;
  const release = (key: string, owner: ReadOwner) => {
    if (!owner.binding && !owner.active && !owner.pending && owners.get(key) === owner) owners.delete(key);
  };
  const isCurrent = (owner: ReadOwner, job: ReadJob) =>
    owner.binding === job.token && owner.generation === job.generation;
  const schedule = (key: string, owner: ReadOwner) => {
    if (owner.queued || owner.active || disposed) return;
    owner.queued = true;
    queueMicrotask(() => {
      owner.queued = false;
      const job = owner.pending;
      if (!job || disposed || owner.active) {
        release(key, owner);
        return;
      }
      owner.pending = undefined;
      if (!isCurrent(owner, job)) {
        release(key, owner);
        return;
      }
      const controller = new AbortController();
      const deadline = setTimeout(() => {
        const error = new Error("The view took too long to load. Retry to load it again.");
        controller.abort(error);
        if (isCurrent(owner, job)) {
          job.onError(error);
        }
      }, options.deadlineMs ?? 30_000);
      const settled = Promise.resolve()
        .then(() => job.run(controller.signal))
        .catch((error) => {
          if (!controller.signal.aborted && isCurrent(owner, job)) job.onError(error);
        })
        .finally(() => {
          clearTimeout(deadline);
          owner.active = undefined;
          if (owner.pending) schedule(key, owner);
          release(key, owner);
        });
      owner.active = { controller, settled };
    });
  };

  return {
    bind(key) {
      if (disposed) throw new Error("Read registry is disposed");
      const owner = owners.get(key) ?? { generation: 0, queued: false };
      owners.set(key, owner);
      owner.active?.controller.abort();
      owner.pending = undefined;
      const token = Symbol(key);
      owner.binding = token;
      owner.generation++;
      return {
        request(request, reason = "refresh") {
          if (owner.binding !== token || disposed) return;
          if (owner.queryKey !== request.queryKey || reason === "retry") {
            owner.generation++;
            owner.active?.controller.abort();
          }
          owner.queryKey = request.queryKey;
          const generation = owner.generation;
          const job: ReadJob = {
            token,
            generation,
            queryKey: request.queryKey,
            onError: request.onError,
            async run(signal) {
              signal.throwIfAborted();
              const value = await request.load(signal);
              if (!signal.aborted && isCurrent(owner, job)) request.onValue(value);
            },
          };
          owner.pending = job;
          schedule(key, owner);
        },
        dispose() {
          if (owner.binding !== token) return;
          owner.binding = undefined;
          owner.pending = undefined;
          owner.generation++;
          owner.active?.controller.abort();
          release(key, owner);
        },
      };
    },
    async dispose() {
      disposed = true;
      const pending: Promise<void>[] = [];
      for (const [key, owner] of owners) {
        owner.binding = undefined;
        owner.pending = undefined;
        if (owner.active) {
          owner.active.controller.abort();
          pending.push(owner.active.settled);
        }
        release(key, owner);
      }
      await Promise.allSettled(pending);
    },
  };
};
