import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { RouteDeps } from "../../features/deps";
import type { ProjectCopy } from "../account/project-copy-store";
import { createRecoveryCatalog } from "./catalog";
import { hasRecoveryChunk, type RecoveryChunk } from "./chunks";
import { openRecoveryJournal, recoveryJournalKey } from "./journal";
import { recoverySourceId } from "./local-source";
import { projectRecoveryRoot } from "./project-paths";

const readDirectory = (path: string) =>
  readdir(path, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });

/** The old layout hid ownership in each private space's encrypted directory name. */
export const moveLegacyRecoveryChunks = async (root: string, projectId: string, roots: RecoveryChunk[]) => {
  const cache = join(root, "chunks");
  const retired = join(projectRecoveryRoot(root, projectId), "legacy-chunks");
  for (const entry of await readDirectory(cache)) {
    if (!entry.isDirectory()) continue;
    const directory = join(cache, entry.name);
    for (const root of roots) {
      if (!(await hasRecoveryChunk(directory, root))) continue;
      await mkdir(retired, { recursive: true, mode: 0o700 });
      // A verified root authenticates the namespace. Move it before deleting any of its files.
      await rename(directory, join(retired, entry.name));
      break;
    }
  }
};

export const collectLegacyProjectRecovery = async (
  deps: Pick<RouteDeps, "projectRecovery" | "workspaceService" | "extensionStorageService">,
  copy: ProjectCopy,
) => {
  const { root } = deps.projectRecovery;
  const sources = join(root, "sources");
  const sourceFiles = await readDirectory(sources);
  if (sourceFiles.length === 0 && (await readDirectory(join(root, "chunks"))).length === 0) return;

  const catalog = createRecoveryCatalog({ ...copy, documents: deps.extensionStorageService.documents });
  const entries = await catalog.list();
  const roots = entries.map((entry) => entry.root);
  const sourceIds = new Set(
    entries.filter(({ deviceId }) => deviceId === copy.deviceId).map(({ sourceId }) => sourceId),
  );
  for (const workspace of await deps.workspaceService.listForProviderReconciliation(copy.projectId)) {
    if (workspace.root_path) sourceIds.add(recoverySourceId(workspace.id, workspace.root_path));
  }
  const journals = [...sourceIds].map((id) => [copy.projectId, copy.accountId, copy.deviceId, id]);
  for (const source of journals) {
    const journal = await openRecoveryJournal({ root, source }).read();
    if (journal.candidate) roots.push(journal.candidate);
  }
  await moveLegacyRecoveryChunks(root, copy.projectId, roots);
  for (const source of journals) {
    const prefix = `${recoveryJournalKey(source)}.`;
    for (const entry of sourceFiles) {
      if (entry.name.startsWith(prefix)) await rm(join(sources, entry.name), { force: true });
    }
  }
};
