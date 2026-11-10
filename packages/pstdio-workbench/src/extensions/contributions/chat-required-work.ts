import type { WorkbenchCore } from "../../core";
import { registerWorkbenchRequiredWork } from "../../core/workbench-required-work";

const owners = new WeakMap<WorkbenchCore, ReturnType<typeof createRequiredChatWork>>();
const createRequiredChatWork = (core: WorkbenchCore) => {
  const jobs = new Set<Promise<unknown>>();
  let closed = false;
  registerWorkbenchRequiredWork(core, async () => {
    closed = true;
    const errors: unknown[] = [];
    while (jobs.size) {
      const results = await Promise.allSettled([...jobs]);
      for (const result of results) if (result.status === "rejected") errors.push(result.reason);
    }
    if (errors.length) throw new AggregateError(errors, "Chat work did not finish");
  });
  const track = <T>(run: () => Promise<T>) => {
    const completion = Promise.withResolvers<T>();
    const running = completion.promise;
    jobs.add(running);
    const release = () => jobs.delete(running);
    void running.then(release, release);
    try {
      run().then(completion.resolve, completion.reject);
    } catch (error) {
      completion.reject(error);
    }
    return running;
  };
  const capture = () => {
    if (closed) throw new Error("Workbench is closed");
    return track;
  };
  return { capture, run: <T>(run: () => Promise<T>) => capture()(run) };
};

/** Capture while the calling core still owns admission; provider hydration is optional journal recovery. */
export const captureRequiredChatWork = (core: WorkbenchCore) => {
  let owner = owners.get(core);
  if (!owner) {
    owner = createRequiredChatWork(core);
    owners.set(core, owner);
  }
  return owner;
};
