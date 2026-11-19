import { createHash } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { acquireRecoveryJournalLease } from "./journal";
import { createRecoveryStagingJournal } from "./restore-staging";

export const projectRecoveryRoot = (root: string, projectId: string) =>
  join(root, "projects", createHash("sha256").update(projectId).digest("hex"));

export const removeProjectFolderRecovery = async (root: string, projectId: string) => {
  const owned = projectRecoveryRoot(root, projectId);
  const sources = join(owned, "sources");
  const names = await readdir(sources).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const leases: Array<() => void> = [];
  try {
    for (const name of names.filter((name) => name.endsWith(".lock.sqlite"))) {
      const release = acquireRecoveryJournalLease(join(sources, name), false);
      if (!release) throw new Error("Another Prompt Studio process owns this folder's recovery");
      leases.push(release);
    }
    if (await createRecoveryStagingJournal(owned).clean())
      throw new Error("A folder restore is still being cleaned up");
    await rm(owned, { recursive: true, force: true });
  } finally {
    for (const release of leases) release();
  }
};
