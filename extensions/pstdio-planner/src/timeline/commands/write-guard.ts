// Use atomic owner claims to prevent overlapping timeline writes across callers.
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export interface WriteClaim {
  key: string;
  token: string;
  startedAt: string;
}

export async function withWriteGuard<T>(
  ctx: Pick<ExtensionContextBase, "storage">,
  key: string,
  write: () => Promise<T>,
) {
  const claims = ctx.storage.collection<WriteClaim>("timeline.write-claims");
  const claim = { key, token: crypto.randomUUID(), startedAt: new Date().toISOString() };
  if (!(await claims.createIfAbsent(key, claim))) {
    throw new Error(
      "Another timeline write is running. Retry when it finishes. After a writer crash, inspect write-claim read and follow README recovery instructions.",
    );
  }

  let outcome: { value: T } | { error: unknown };
  try {
    outcome = { value: await write() };
  } catch (error) {
    outcome = { error };
  }

  try {
    await claims.deleteIfValue(key, claim);
  } catch (reason) {
    if ("error" in outcome) {
      throw outcome.error;
    }
    throw new Error(
      `Write claim release failed: ${String(reason)}. Inspect write-claim read and follow README recovery instructions.`,
    );
  }

  if ("error" in outcome) {
    throw outcome.error;
  }
  return outcome.value;
}
