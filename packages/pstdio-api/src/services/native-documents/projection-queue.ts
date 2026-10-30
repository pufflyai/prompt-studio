import type { StorageOwner } from "pstdio-sync";

interface Address {
  owner: StorageOwner;
  documentKey: string;
}
interface Job {
  dirty: boolean;
  completed: number;
  work: Promise<void>;
  fences: Set<{ revision: number; resolve: () => void; reject: (error: unknown) => void }>;
}

const completeProjectionFences = (job: Job) => {
  for (const fence of job.fences)
    if (fence.revision <= job.completed) {
      job.fences.delete(fence);
      fence.resolve();
    }
};

/** Coalesce file work without making durable editor traffic wait for extension handlers. */
export const createNativeProjectionQueue = (input: {
  reconcile: (address: Address) => Promise<number | void>;
  failed: (address: Address, error: unknown) => void;
}) => {
  const jobs = new Map<string, Job>();
  const request = (address: Address) => {
    const key = JSON.stringify([address.owner, address.documentKey]);
    const current = jobs.get(key);
    if (current) {
      current.dirty = true;
      return current;
    }
    const job: Job = { dirty: true, completed: 0, work: Promise.resolve(), fences: new Set() };
    job.work = Promise.resolve().then(async () => {
      try {
        while (job.dirty) {
          job.dirty = false;
          job.completed = (await input.reconcile(address)) ?? 0;
          completeProjectionFences(job);
        }
        if (job.fences.size) throw new Error("The requested projection revision is unavailable");
      } catch (error) {
        for (const fence of job.fences) fence.reject(error);
        throw error;
      } finally {
        jobs.delete(key);
      }
    });
    jobs.set(key, job);
    void job.work.catch((error) => input.failed(address, error));
    return job;
  };
  return {
    request: (address: Address) => request(address).work,
    through(address: Address, revision: number) {
      const job = request(address);
      if (job.completed >= revision) return Promise.resolve();
      const fence = Promise.withResolvers<void>();
      job.fences.add({ revision, ...fence });
      return fence.promise;
    },
    async drain() {
      await Promise.allSettled([...jobs.values()].map((job) => job.work));
    },
  };
};
