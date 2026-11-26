import { assertExtensionUpgradeWorkingTree, ExtensionUpgradeNeedsReviewError } from "./extension-upgrade-baseline";
import type { ReviewRecord } from "./review-extension-source-record";
import { diffExtensionReviewPaths, readExtensionReviewTree } from "./review-extension-source-tree";

export type ExtensionReviewSource = {
  path: string;
  ref: string | null;
  separateProviderId?: string;
};

export class StaleExtensionUpgradeReview extends ExtensionUpgradeNeedsReviewError {
  constructor(
    message: string,
    readonly changedPaths: string[] = [],
  ) {
    super(message);
  }
}

export const assertSameReviewSource = (record: ReviewRecord, source: ExtensionReviewSource) => {
  if (
    source.path !== record.sourcePath ||
    source.ref !== record.sourceRef ||
    source.separateProviderId !== record.separateProviderId
  )
    throw new StaleExtensionUpgradeReview("The active extension source changed while this review was open.");
};

export const reviewWorkingCopyChanges = async (
  snapshotPath: string,
  path: string,
  fingerprint: string,
  ignoreGit: boolean,
): Promise<string[] | undefined> => {
  try {
    assertExtensionUpgradeWorkingTree(path, fingerprint, { ignoreGit });
    return undefined;
  } catch (error) {
    if (!(error instanceof ExtensionUpgradeNeedsReviewError)) throw error;
  }
  try {
    const [snapshot, current] = await Promise.all([
      readExtensionReviewTree(snapshotPath),
      readExtensionReviewTree(path, { ignoreGit }),
    ]);
    return diffExtensionReviewPaths(snapshot, current);
  } catch {
    // The source may have been moved, removed or changed to an unsupported file type.
    return [];
  }
};
