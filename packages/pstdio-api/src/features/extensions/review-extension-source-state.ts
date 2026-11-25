import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionUpgradeReviewResolution } from "pstdio-api-contracts";
import { withFileMutationLock } from "pstdio-paths";
import { ExtensionUpgradeNeedsReviewError } from "./extension-upgrade-baseline";
import type { ReviewRecord } from "./review-extension-source-record";
import { readExtensionReviewTree } from "./review-extension-source-tree";

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
