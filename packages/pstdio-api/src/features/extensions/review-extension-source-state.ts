import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionUpgradeReviewResolution } from "pstdio-api-contracts";
import { withFileMutationLock } from "pstdio-paths";
import { ExtensionUpgradeNeedsReviewError } from "./extension-upgrade-baseline";
import type { ReviewRecord } from "./review-extension-source-record";
import { planExtensionReview, readExtensionReviewTree } from "./review-extension-source-tree";

export type ReviewState = {
  revision: string;
  resolutions: ExtensionUpgradeReviewResolution[];
  previousResolutions?: ExtensionUpgradeReviewResolution[];
  snapshot?: { id: string; fingerprint: string };
};

export const applyingReviews = new Set<string>();
const stateFile = (directory: string) => join(directory, "choices.json");

export const readReviewState = (directory: string, expectedRevision?: string): ReviewState => {
  let state: ReviewState = { revision: "initial", resolutions: [] };
  try {
    state = JSON.parse(readFileSync(stateFile(directory), "utf8")) as ReviewState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (expectedRevision !== undefined && expectedRevision !== state.revision)
    throw new ExtensionUpgradeNeedsReviewError("Another view saved resolutions. Reopen the review to load them.");
  return state;
};

export const saveReviewState = (directory: string, expectedRevision: string, state: ReviewState) => {
  const file = stateFile(directory);
  withFileMutationLock(file, () => {
    if (applyingReviews.has(directory)) throw new ExtensionUpgradeNeedsReviewError("This upgrade is already applying.");
    readReviewState(directory, expectedRevision);
    const stage = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      writeFileSync(stage, JSON.stringify(state), { mode: 0o600, flag: "wx" });
      renameSync(stage, file);
    } finally {
      rmSync(stage, { force: true });
    }
  });
};

export const reviewLocalPath = (directory: string, snapshot?: ReviewState["snapshot"]) =>
  join(directory, snapshot ? `local-${snapshot.id}` : "local");

export const readReviewTrees = (directory: string, record: ReviewRecord, state: ReviewState) =>
  Promise.all([
    record.based ? readExtensionReviewTree(join(directory, "base")) : undefined,
    readExtensionReviewTree(reviewLocalPath(directory, state.snapshot)),
    readExtensionReviewTree(join(directory, "incoming")),
  ] as const);

export const resolutionMap = (choices: ExtensionUpgradeReviewResolution[]) => {
  const totalTextBytes = choices.reduce(
    (size, choice) => size + (choice.kind === "text" ? Buffer.byteLength(choice.text) : 0),
    0,
  );
  if (totalTextBytes > 16 * 1024 * 1024) throw new Error("The staged text resolutions are too large.");
  const resolutions = new Map(choices.map((choice) => [choice.path, choice]));
  if (resolutions.size !== choices.length) throw new Error("A path has more than one upgrade resolution.");
  return resolutions;
};

// The API owner pins a generation before any asynchronous reads of its files.
const snapshotReaders = new Map<string, number>();
const retiredSnapshots = new Map<string, Set<string>>();
const reclaimSnapshots = async (directory: string) => {
  const retired = retiredSnapshots.get(directory);
  if (!retired) return;
  await Promise.all(
    [...retired]
      .filter((path) => !snapshotReaders.has(path))
      .map(async (path) => {
        // Claim this removal before yielding so another reader cannot start it again.
        retired.delete(path);
        try {
          await rm(path, { recursive: true, force: true });
        } catch {
          const pending = retiredSnapshots.get(directory) ?? new Set<string>();
          pending.add(path);
          retiredSnapshots.set(directory, pending);
        }
      }),
  );
  if (!retired.size && retiredSnapshots.get(directory) === retired) retiredSnapshots.delete(directory);
};
export const retireReviewSnapshot = async (directory: string, state: ReviewState) => {
  const retired = retiredSnapshots.get(directory) ?? new Set<string>();
  retired.add(reviewLocalPath(directory, state.snapshot));
  retiredSnapshots.set(directory, retired);
  await reclaimSnapshots(directory);
};
export const withReviewSnapshot = async <T>(
  directory: string,
  revision: string | undefined,
  read: (state: ReviewState) => Promise<T>,
) => {
  const state = readReviewState(directory, revision);
  const path = reviewLocalPath(directory, state.snapshot);
  snapshotReaders.set(path, (snapshotReaders.get(path) ?? 0) + 1);
  try {
    return await read(state);
  } finally {
    const count = snapshotReaders.get(path)! - 1;
    if (count) snapshotReaders.set(path, count);
    else snapshotReaders.delete(path);
    await reclaimSnapshots(directory);
  }
};

export const reviewSummary = (
  record: ReviewRecord,
  choices: ReviewState,
  trees: Awaited<ReturnType<typeof readReviewTrees>>,
  changedPaths?: string[],
) => ({
  id: record.id,
  incomingVersion: record.incomingVersion,
  hasOriginal: record.based,
  separateLocalProvider: record.separateProviderId !== undefined,
  localPath: record.sourcePath,
  createdAt: record.createdAt,
  revision: choices.revision,
  resolutions: choices.resolutions,
  previousResolutions: choices.previousResolutions,
  changedPaths,
  changes: planExtensionReview(...trees, resolutionMap(choices.resolutions)).changes,
});
