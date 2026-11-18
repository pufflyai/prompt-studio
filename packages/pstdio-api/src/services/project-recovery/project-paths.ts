import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createRecoveryStagingJournal } from "./restore-staging";

export const projectRecoveryRoot = (root: string, projectId: string) =>
  join(root, "projects", createHash("sha256").update(projectId).digest("hex"));

export const removeProjectFolderRecovery = async (root: string, projectId: string) => {
  const owned = projectRecoveryRoot(root, projectId);
  await createRecoveryStagingJournal(owned).clean();
  await rm(owned, { recursive: true, force: true });
};
