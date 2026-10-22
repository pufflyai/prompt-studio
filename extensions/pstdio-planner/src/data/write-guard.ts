// One database-owner process runs Planner commands and hooks. Ownership must die with that runtime.
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

type WriteGuardContext = Pick<ExtensionContextBase, "projectId" | "extensionId">;

// Runtime reloads import new source snapshots while old handlers may still be running.
const registryKey = Symbol.for("pstdio.pstdio-planner.write-guards");
const runtime = globalThis as typeof globalThis & { [registryKey]?: Set<string> };
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
  }
}
