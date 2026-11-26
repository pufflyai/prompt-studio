import { rm } from "node:fs/promises";
import type { ExtensionUpgradeReviewResolution } from "pstdio-api-contracts";
import { assertExtensionUpgradeWorkingTree } from "./extension-upgrade-baseline";
import { fingerprintUpgradeWorkingTree } from "./extension-upgrade-working-tree";
import { loadExtensionReviewRecord as loadRecord } from "./review-extension-source-record";
import {
  type ReviewState,
  readReviewTrees,
  resolutionMap,
  retireReviewSnapshot,
  reviewLocalPath,
  reviewSummary,
  saveReviewState,
  withReviewSnapshot,
} from "./review-extension-source-state";
import {
  isSameExtensionReviewPath,
  planExtensionReview,
  readExtensionReviewTree,
  writeExtensionReviewTree,
} from "./review-extension-source-tree";
import { assertSameReviewSource, type ExtensionReviewSource } from "./review-extension-working-copy";

export const refreshExtensionSourceReview = async (
  home: string,
  id: string,
  projectId: string,
  instanceId: string,
  source: ExtensionReviewSource,
  revision: string,
  draft?: ExtensionUpgradeReviewResolution[],
) => {
  const review = await loadRecord(home, id, projectId, instanceId);
  if (!review) return null;
  const { directory, record } = review;
  assertSameReviewSource(record, source);
  return withReviewSnapshot(directory, revision, async (state) => {
    const [base, previousLocal, incoming] = await readReviewTrees(directory, record, state);
    const options = { ignoreGit: source.separateProviderId !== undefined };
    const fingerprint = fingerprintUpgradeWorkingTree(source.path, options);
    const local = await readExtensionReviewTree(source.path, options);
    const resolutions = draft ?? state.resolutions;
    planExtensionReview(base, previousLocal, incoming, resolutionMap(resolutions));
    const remaining = planExtensionReview(base, local, incoming).unresolved;
    const retained = [];
    const previous = new Map(state.previousResolutions?.map((choice) => [choice.path, choice]));
    for (const choice of resolutions) {
      if (remaining.has(choice.path) && isSameExtensionReviewPath(previousLocal, local, choice.path))
        retained.push(choice);
      else previous.set(choice.path, choice);
    }
    const next: ReviewState = {
      revision: crypto.randomUUID(),
      snapshot: { id: crypto.randomUUID(), fingerprint },
      resolutions: retained,
      previousResolutions: [...previous.values()],
    };
    const path = reviewLocalPath(directory, next.snapshot);
    const summary = reviewSummary(record, next, [base, local, incoming]);
    try {
      await writeExtensionReviewTree(path, local);
      assertExtensionUpgradeWorkingTree(source.path, fingerprint, options);
      saveReviewState(directory, revision, next);
    } catch (error) {
      await rm(path, { recursive: true, force: true });
      throw error;
    }
    await retireReviewSnapshot(directory, state);
    return summary;
  });
};
