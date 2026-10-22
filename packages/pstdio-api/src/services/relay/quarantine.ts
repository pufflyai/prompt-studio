import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePstdioStatePath } from "pstdio-paths";
import type { SyncFailure } from "pstdio-sync/relay";
import { apiLogger } from "../../lib/logger";

export const createSyncQuarantine =
  (scope: { accountId: string; projectId: string; documentId: string }) => async (failure: SyncFailure) => {
    const key = createHash("sha256")
      .update(JSON.stringify([scope, failure.kind, failure.id]))
      .digest("hex");
    const directory = join(resolvePstdioStatePath(), "sync-quarantine");
    const path = join(directory, `${key}.json`);
    const temporary = `${path}.${crypto.randomUUID()}.tmp`;
    await mkdir(directory, { recursive: true });
    try {
      // Keep only the encrypted envelope and opaque IDs. No keys, plaintext, or exception details.
      await writeFile(temporary, JSON.stringify({ ...scope, ...failure }), { mode: 0o600 });
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
    apiLogger.warn(
      { event: "relay.data.quarantined", documentId: scope.documentId, kind: failure.kind, id: failure.id },
      "Unreadable sync data was set aside; other updates will continue",
    );
  };
