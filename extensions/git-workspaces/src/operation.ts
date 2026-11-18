// Host refreshes import a new extension bundle while earlier calls can still own Git processes.
// Keep this extension's transient resource queue across those imports; remove settled owners.
const key = Symbol.for("pstdio.git-workspaces.operations");
const registry = globalThis as unknown as Record<symbol, Map<string, Promise<unknown>>>;
registry[key] ??= new Map();
const operations = registry[key];

export const runGitWorkspaceOperation = async <T>(workspaceId: string, run: () => Promise<T>) => {
  const previous = operations.get(workspaceId);
  const running = (previous ? previous.catch(() => {}) : Promise.resolve()).then(run);
  operations.set(workspaceId, running);
  try {
    return await running;
  } finally {
    if (operations.get(workspaceId) === running) operations.delete(workspaceId);
  }
};
