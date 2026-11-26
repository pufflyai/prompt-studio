import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { threadId } from "node:worker_threads";
import {
  isPreparationHost,
  type PreparedExtensionRevision,
  preparedRevisionState,
  readAcceptedRevision,
  readPackageManifestMetadata,
} from "pstdio-extensions";
import { hashExtensionSource } from "pstdio-extensions/authoring";
import {
  currentFileMutationWorker,
  isFileMutationOwnerAlive,
  resolvePstdioHome,
  withFileMutationLock,
} from "pstdio-paths";
import { apiLogger, setupLogger } from "../../lib/logger";
import { runExtensionPreparation } from "./extension-preparation";
import { assertExtensionUpgradeWorkingTree } from "./extension-upgrade-baseline";
import { readPreparationRecord } from "./preparation-record";
import { promotePreparedSource } from "./promote-extension-source";

export interface ExtensionInstallTransaction {
  intentPath: string;
}
interface InstallationIntent {
  root: string;
  targetPath: string;
  installPath: string;
  sourceHash: string;
  preserveDependencies: boolean;
  replaceExisting: boolean;
  upgradeFromVersion?: string | null;
  upgradeBaseline?: string;
  revision?: PreparedExtensionRevision;
  owner: { pid: number; threadId: number; worker?: string };
  ownership?: { ownerPath: string; token: string; previousToken: string | null };
}
const ownsClaim = (intent: InstallationIntent) => {
  try {
    return Boolean(intent.ownership && readFileSync(intent.ownership.ownerPath, "utf8") === intent.ownership.token);
  } catch {
    return false;
  }
};
const ownsTarget = (intent: InstallationIntent) => {
  try {
    return Boolean(
      ownsClaim(intent) &&
        existsSync(intent.targetPath) &&
        hashExtensionSource(intent.targetPath) === intent.sourceHash,
    );
  } catch {
    return false;
  }
};
const writeIntent = (
  path: string,
  intent: Omit<InstallationIntent, "owner"> & { owner: InstallationIntent["owner"] },
) => {
  const stage = `${path}.tmp`;
  writeFileSync(stage, JSON.stringify(intent));
  renameSync(stage, path);
};
const completedPath = (transaction: ExtensionInstallTransaction) =>
  join(dirname(transaction.intentPath), "completed", basename(transaction.intentPath));
const readIntent = (transaction: ExtensionInstallTransaction) => {
  const path = existsSync(transaction.intentPath) ? transaction.intentPath : completedPath(transaction);
  return JSON.parse(readFileSync(path, "utf8")) as InstallationIntent;
};
export const assertPreparedInstallOwned = async (transaction: ExtensionInstallTransaction) => {
  if (isPreparationHost)
    return runExtensionPreparation<void>("install.assert", { transaction }, { priority: "requested" });
  const intent = readIntent(transaction);
  if (!ownsTarget(intent)) throw new Error("A newer installation replaced this prepared extension.");
};
export const retainPreparedInstall = (input: Omit<InstallationIntent, "owner">): ExtensionInstallTransaction => {
  const root = join(resolvePstdioHome(), "cache", "extension-installations");
  mkdirSync(root, { recursive: true });
  const intentPath = join(root, `${crypto.randomUUID()}.json`);
  writeIntent(intentPath, { ...input, owner: { pid: process.pid, threadId, worker: currentFileMutationWorker() } });
  return { intentPath };
};
// Claim only delivered handles. Until this synchronous host handoff, a retired worker
// owns the intent and its replacement may recover a successful but discarded result.
export const claimPreparedInstall = (transaction: ExtensionInstallTransaction) => {
  const intent = readIntent(transaction);
  writeIntent(transaction.intentPath, { ...intent, owner: { pid: process.pid, threadId: 0 } });
};
// Activation finishes an accepted user operation; speculative checks must not repeatedly
// retire its worker while preparing the filesystem swap.
export const activatePreparedInstall = async (transaction: ExtensionInstallTransaction) => {
  if (isPreparationHost)
    return runExtensionPreparation<void>("install.activate", { transaction }, { priority: "requested" });
  const intent = readIntent(transaction);
  if (intent.ownership) return assertPreparedInstallOwned(transaction);
  const { upgradeBaseline } = intent;
  await promotePreparedSource(
    intent.installPath,
    intent.targetPath,
    intent.replaceExisting,
    intent.preserveDependencies,
    (ownership) => {
      // The target can move forward while an upgrade for another project is being prepared.
      // This callback runs under the destination lock, before the ownership token or files change.
      if (intent.upgradeFromVersion !== undefined) {
        const next =
          intent.revision?.manifest.version ?? readPackageManifestMetadata(intent.installPath).manifest?.version;
        const current = readPackageManifestMetadata(intent.targetPath).manifest?.version ?? intent.upgradeFromVersion;
        if (current && (!next || Bun.semver.order(next, current) < 0))
          throw new Error(`Cannot downgrade extension from ${current} to ${next ?? "an unknown version"}.`);
      }
      intent.ownership = ownership;
      writeIntent(transaction.intentPath, intent);
    },
    upgradeBaseline ? (previousPath) => assertExtensionUpgradeWorkingTree(previousPath, upgradeBaseline) : undefined,
  );
};
const oldDependencies = (intent: InstallationIntent) => join(intent.root, ".previous", "node_modules");
const dependencyGarbage = (intent: InstallationIntent) => `${intent.root}.old-dependencies`;

const detachOldDependencies = (intent: InstallationIntent) => {
  const previous = oldDependencies(intent);
  const garbage = dependencyGarbage(intent);
  if (existsSync(previous)) renameSync(previous, garbage);
  return existsSync(garbage) ? garbage : undefined;
};

const removeDetachedDependencies = (path: string) => {
  // Let the first action use the new extension before starting package-tree maintenance.
  // The committed receipt keeps the directory discoverable if the host exits first.
  setTimeout(() => {
    void rm(path, { recursive: true, force: true }).catch((error) =>
      apiLogger.warn(
        { event: "extension.upgrade.dependency_cleanup_failed", err: error },
        "Could not remove old dependencies",
      ),
    );
  }, 1_000).unref();
};

const restorePreviousInstall = (intent: InstallationIntent) => {
  const previous = join(intent.root, ".previous");
  const detached = dependencyGarbage(intent);
  if (existsSync(detached) && !existsSync(oldDependencies(intent))) renameSync(detached, oldDependencies(intent));
  if (
    intent.preserveDependencies &&
    existsSync(previous) &&
    existsSync(join(intent.targetPath, "node_modules")) &&
    !existsSync(join(previous, "node_modules"))
  )
    renameSync(join(intent.targetPath, "node_modules"), join(previous, "node_modules"));
  rmSync(intent.targetPath, { recursive: true, force: true });
  if (existsSync(previous)) renameSync(previous, intent.targetPath);
  if (intent.ownership!.previousToken) writeFileSync(intent.ownership!.ownerPath, intent.ownership!.previousToken!);
  else rmSync(intent.ownership!.ownerPath, { force: true });
};
const preserveChangedUpgradeBackup = (intent: InstallationIntent, transaction: ExtensionInstallTransaction) => {
  const previous = join(intent.root, ".previous");
  if (!intent.upgradeBaseline || !existsSync(previous)) return;
  try {
    assertExtensionUpgradeWorkingTree(previous, intent.upgradeBaseline);
    return;
  } catch {
    // An editor can still write to the moved directory while the host publishes the new revision.
  }
  const directory = join(dirname(dirname(intent.targetPath)), ".extension-upgrade-recovery");
  mkdirSync(directory, { recursive: true });
  const id = basename(transaction.intentPath, ".json");
  const recoveryPath = join(directory, `${basename(intent.targetPath)}-${id}`);
  renameSync(previous, recoveryPath);
  apiLogger.warn(
    { event: "extension.upgrade.recovered_edits", sourcePath: intent.targetPath, recoveryPath },
    "Preserved local extension edits written during an upgrade",
  );
};

export const settlePreparedInstall = async (transaction: ExtensionInstallTransaction, commit: boolean) => {
  if (!isPreparationHost) {
    const detached = settlePreparedInstallOnWorker(transaction, commit);
    if (detached) removeDetachedDependencies(detached);
    return;
  }
  const detached = await runExtensionPreparation<string | undefined>(
    "install.settle",
    { transaction, commit },
    { priority: "requested" },
  );
  if (detached) removeDetachedDependencies(detached);
};

export const settlePreparedInstallOnWorker = (transaction: ExtensionInstallTransaction, commit: boolean) => {
  let intent: InstallationIntent;
  try {
    intent = JSON.parse(readFileSync(transaction.intentPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const extensionsRoot = realpathSync.native(dirname(intent.targetPath));
  const lock = join(dirname(extensionsRoot), ".extension-source-locks", basename(intent.targetPath));
  const detached = withFileMutationLock(lock, () => {
    if (!existsSync(transaction.intentPath)) return;
    let detached: string | undefined;
    const owns = ownsTarget(intent);
    if (commit && !owns) throw new Error("A newer installation replaced this prepared extension.");
    if (!commit && ownsClaim(intent)) {
      // The claim is durable before either rename. A killed worker may have moved only
      // the old target, or may not yet have touched it at all.
      if (existsSync(join(intent.root, ".previous")) || !existsSync(intent.installPath)) restorePreviousInstall(intent);
      else if (intent.ownership!.previousToken)
        writeFileSync(intent.ownership!.ownerPath, intent.ownership!.previousToken!);
      else rmSync(intent.ownership!.ownerPath, { force: true });
    }
    if (commit) {
      preserveChangedUpgradeBackup(intent, transaction);
      // A committed upgrade retains authored backup changes at this point. Generated
      // dependencies can be removed asynchronously without delaying activation.
      if (intent.upgradeBaseline) detached = detachOldDependencies(intent);
      const completed = completedPath(transaction);
      mkdirSync(dirname(completed), { recursive: true });
      writeIntent(completed, intent);
    } else {
      rmSync(intent.root, { recursive: true, force: true });
    }
    rmSync(transaction.intentPath, { force: true });
    return detached;
  });
  if (commit)
    void rm(intent.root, { recursive: true, force: true }).catch((err) =>
      setupLogger.warn({ err, event: "extension.installation.cleanup" }, "Retired extension cleanup will retry"),
    );
  return detached;
};
const recoverInstall = async (intentPath: string, disposing: boolean) => {
  const transaction = { intentPath };
  const intent = readPreparationRecord<InstallationIntent>(intentPath);
  if (!intent) return;
  const ownedHere = intent.owner.pid === process.pid;
  if (!(disposing && ownedHere) && isFileMutationOwnerAlive(intent.owner)) return;
  const accepted = await readAcceptedRevision(intent.targetPath);
  const committed = Boolean(
    intent.revision && preparedRevisionState(accepted) === preparedRevisionState(intent.revision),
  );
  try {
    await settlePreparedInstall(transaction, committed && ownsTarget(intent));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || existsSync(intentPath)) throw error;
  }
};
export const recoverPreparedInstalls = async (disposing = false) => {
  const root = join(resolvePstdioHome(), "cache", "extension-installations");
  if (!existsSync(root)) return;
  const completed = join(root, "completed");
  if (existsSync(completed))
    for (const name of readdirSync(completed).filter((name) => name.endsWith(".json"))) {
      const path = join(completed, name);
      const intent = readPreparationRecord<InstallationIntent>(path);
      if (!intent) continue;
      if (!isFileMutationOwnerAlive(intent.owner) || (disposing && intent.owner.pid === process.pid)) {
        // A process can exit after committing the new revision but before removing old dependencies.
        // Keep the recovery receipt if cleanup fails so the next run can retry.
        try {
          await rm(intent.root, { recursive: true, force: true });
          await rm(dependencyGarbage(intent), { recursive: true, force: true });
          rmSync(path, { force: true });
        } catch {}
      }
    }
  for (const name of readdirSync(root).filter((name) => name.endsWith(".json")))
    await recoverInstall(join(root, name), disposing);
};
