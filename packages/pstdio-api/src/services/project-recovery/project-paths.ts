import { createHash } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { acquireRecoveryJournalLease, acquireRecoveryProjectLease } from "./journal";
import { createRecoveryStagingJournal } from "./restore-staging";

export const projectRecoveryRoot = (root: string, projectId: string) =>
  join(root, "projects", createHash("sha256").update(projectId).digest("hex"));

export const removeProjectFolderRecovery = async (root: string, projectId: string) => {
  const owned = projectRecoveryRoot(root, projectId);
  const sources = join(owned, "sources");
  const leases: Array<() => void> = [];
  const releaseProject = await acquireRecoveryProjectLease(owned, true);
  if (!releaseProject) throw new Error("Another Prompt Studio process owns this folder's recovery");
  try {
    const names = await readdir(sources).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const name of names.filter((name) => name.endsWith(".lock.sqlite"))) {
      const release = acquireRecoveryJournalLease(join(sources, name), false);
      if (!release) throw new Error("Another Prompt Studio process owns this folder's recovery");
      leases.push(release);
    }
    if (await createRecoveryStagingJournal(owned).clean())
      throw new Error("A folder restore is still being cleaned up");
    // The scan only proves no source is owned. Windows cannot delete files this process still
    // holds open, and the exclusive project lease keeps new owners out until removal finishes.
    for (const release of leases.splice(0)) release();
    // Windows indexers and scanners can briefly reopen the just-closed lease files.
    await rm(owned, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } finally {
    for (const release of leases) release();
    releaseProject();
  }
};
