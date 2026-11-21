import { AsyncLocalStorage } from "node:async_hooks";

const owners = new WeakMap<object, Map<string, Promise<unknown>>>();
const active = new AsyncLocalStorage<{ owner: object; projects: ReadonlyMap<string, { active: boolean }> }>();

/** A local choice and its shared publication are one ordered project operation. */
export const withProjectExtensionChoices = <T>(owner: object, projectId: string, change: () => Promise<T>) => {
  const current = active.getStore();
  if (current?.owner === owner && current.projects.get(projectId)?.active) return change();
  let pending = owners.get(owner);
  if (!pending) {
    pending = new Map();
    owners.set(owner, pending);
  }
  const previous = pending.get(projectId) ?? Promise.resolve();
  const projects = new Map(current?.owner === owner ? current.projects : []);
  const lease = { active: true };
  projects.set(projectId, lease);
  const work = previous
    .catch(() => {})
    .then(() =>
      active.run({ owner, projects }, async () => {
        try {
          return await change();
        } finally {
          lease.active = false;
        }
      }),
    );
  pending.set(projectId, work);
  void work
    .finally(() => {
      if (pending.get(projectId) === work) pending.delete(projectId);
    })
    .catch(() => {});
  return work;
};
