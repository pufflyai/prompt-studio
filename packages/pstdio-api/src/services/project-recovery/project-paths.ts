import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createRecoveryStagingJournal } from "./restore-staging";

export const projectRecoveryRoot = (root: string, projectId: string) =>
  join(root, "projects", createHash("sha256").update(projectId).digest("hex"));

export const removeProjectFolderRecovery = async (root: string, projectId: string) => {
  const owned = projectRecoveryRoot(root, projectId);
  if (await createRecoveryStagingJournal(owned).clean()) throw new Error("A folder restore is still being cleaned up");
  await rm(owned, { recursive: true, force: true });
};
