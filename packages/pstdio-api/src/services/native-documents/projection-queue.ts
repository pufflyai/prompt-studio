import type { StorageOwner } from "pstdio-sync";

interface Address {
  owner: StorageOwner;
  documentKey: string;
}

/** Coalesce file work without making durable editor traffic wait for extension handlers. */
export const createNativeProjectionQueue = (input: {
  reconcile: (address: Address) => Promise<void>;
  failed: (address: Address, error: unknown) => void;
}) => {
  const jobs = new Map<string, { dirty: boolean; work: Promise<void> }>();
  const request = (address: Address) => {
    const key = JSON.stringify([address.owner, address.documentKey]);
    const current = jobs.get(key);
    if (current) {
      current.dirty = true;
      return current.work;
    }
    const job = { dirty: true, work: Promise.resolve() };
    job.work = Promise.resolve().then(async () => {
      try {
        while (job.dirty) {
          job.dirty = false;
          await input.reconcile(address);
        }
      } finally {
        jobs.delete(key);
      }
    });
    jobs.set(key, job);
    void job.work.catch((error) => input.failed(address, error));
    return job.work;
  };
  return {
    request,
    async drain() {
      await Promise.allSettled([...jobs.values()].map((job) => job.work));
    },
  };
};
