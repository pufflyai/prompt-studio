import { join } from "node:path";
import { assertExtensionUpgradeWorkingTree, ExtensionUpgradeNeedsReviewError } from "./extension-upgrade-baseline";
import { diffExtensionReviewPaths, readExtensionReviewTree } from "./review-extension-source-tree";

export class StaleExtensionUpgradeReview extends ExtensionUpgradeNeedsReviewError {
  constructor(
    message: string,
    readonly changedPaths: string[] = [],
  ) {
    super(message);
  }
}

export const reviewWorkingCopyChanges = async (
  directory: string,
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
      readExtensionReviewTree(join(directory, "local")),
      readExtensionReviewTree(path, { ignoreGit }),
    ]);
    return diffExtensionReviewPaths(snapshot, current);
  } catch {
    // The source may have been moved, removed or changed to an unsupported file type.
    return [];
  }
};
