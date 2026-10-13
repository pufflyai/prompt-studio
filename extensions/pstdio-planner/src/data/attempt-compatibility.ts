import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { readRetiredWorkspaceIds } from "./attempt-retirement";
import { deriveRevisionVerdict } from "./attempt-state";
import type { AttemptRecord, AttemptState } from "./attempt-types";

// Compatibility output is evidence about the variant, never a workflow precondition.
export const legacyAttemptOutput = async (storage: ExtensionStorageApi, variant: AttemptRecord) => {
  const retired = (await readRetiredWorkspaceIds(storage)).has(variant.workspaceId);
  const revision = variant.revisions.at(-1);
  const verdict = revision ? deriveRevisionVerdict(revision) : null;
  let state: AttemptState = "implementing";
  if (revision) state = "review_ready";
  if (revision?.reviews.some((review) => review.state === "started")) state = "reviewing";
  if (verdict === "passed") state = "approved";
  if (verdict === "changes_requested") state = "changes_requested";
  if (variant.blocker) state = "blocked";
  if (retired) state = "abandoned";
  return { ...variant, state };
};
