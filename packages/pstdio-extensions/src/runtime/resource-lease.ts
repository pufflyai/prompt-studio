import { AsyncLocalStorage } from "node:async_hooks";

export interface ResourceAllocation {
  releaseCpu: () => void;
  resumeCpu: () => void;
  release: () => void;
}
interface ResourceLease {
  coordinator: object;
  suspended: boolean;
  done: boolean;
  wait: <T>(work: () => T | Promise<T>) => Promise<T>;
}

const current = new AsyncLocalStorage<ResourceLease>();
export const holdsExtensionAdmission = (coordinator: object) => {
  const lease = current.getStore();
  return lease?.coordinator === coordinator && !lease.suspended && !lease.done;
};

// Exported host callback handles preserve this async scope across IPC delivery.
export const withExtensionHostWait = <T>(work: () => T | Promise<T>) => current.getStore()?.wait(work) ?? work();

export const runWithExtensionAdmission = async <T>(
  coordinator: object,
  initial: ResourceAllocation,
  work: () => Promise<T>,
) => {
  const lease: ResourceLease = {
    coordinator,
    suspended: false,
    done: false,
    wait: async (run) => {
      if (lease.done) return run();
      if (!lease.suspended) {
        initial.releaseCpu();
        lease.suspended = true;
      }
      try {
        return await run();
      } finally {
        // Accepted work resumes even if headroom fell or another admitted job is running.
        // Its restored charge stops new admissions; pressure never kills the accepted mutation.
        if (!lease.done) {
          initial.resumeCpu();
          lease.suspended = false;
        }
      }
    },
  };
  try {
    return await current.run(lease, work);
  } finally {
    lease.done = true;
    initial.release();
  }
};
