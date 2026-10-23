// One database-owner process runs Planner commands and hooks. Ownership must die with that runtime.
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

type WriteGuardContext = Pick<ExtensionContextBase, "projectId" | "extensionId">;

// Runtime reloads import new source snapshots while old handlers may still be running.
const registryKey = Symbol.for("pstdio.pstdio-planner.write-guards");
const waitersKey = Symbol.for("pstdio.pstdio-planner.write-waiters");
const runtime = globalThis as typeof globalThis & {
  [registryKey]?: Set<string>;
  [waitersKey]?: Map<string, Set<() => void>>;
};
runtime[waitersKey] ??= new Map();
const waiters = runtime[waitersKey];
runtime[registryKey] ??= new Set<string>();
const active = runtime[registryKey];

export async function withWriteGuard<T>(
  ctx: WriteGuardContext,
  key: string,
  write: () => Promise<T>,
  onBusy?: () => T,
) {
  const owner = JSON.stringify([ctx.projectId, ctx.extensionId, key]);
  if (active.has(owner)) {
    if (onBusy) return onBusy();
    throw new Error("Another Planner write is running. Retry when it finishes.");
  }
  active.add(owner);
  try {
    return await write();
  } finally {
    active.delete(owner);
    const waiting = waiters.get(owner);
    waiters.delete(owner);
    for (const resolve of waiting ?? []) resolve();
  }
}

// Stop must observe the records a session launch is still writing before it cancels their owners.
export async function withQueuedWriteGuard<T>(ctx: WriteGuardContext, key: string, write: () => Promise<T>) {
  const owner = JSON.stringify([ctx.projectId, ctx.extensionId, key]);
  while (active.has(owner)) {
    await new Promise<void>((resolve) => {
      const waiting = waiters.get(owner) ?? new Set();
      waiting.add(resolve);
      waiters.set(owner, waiting);
    });
  }
  return withWriteGuard(ctx, key, write);
}
