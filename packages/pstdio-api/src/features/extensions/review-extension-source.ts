import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ExtensionUpgradeReviewResolution } from "pstdio-api-contracts";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import { readPackageManifest } from "pstdio-extensions";
import { copyExtensionSource } from "./copy-extension-source";
import {
  assertExtensionUpgradeWorkingTree,
  ExtensionUpgradeNeedsReviewError,
  recoverExtensionUpgradeBaseline,
} from "./extension-upgrade-baseline";
import { fingerprintUpgradeWorkingTree } from "./extension-upgrade-working-tree";
import type { InstallExtensionSourceInput } from "./install-extension-source-types";
import { resolveInstallSource } from "./resolve-install-source";
import {
  loadExtensionReviewRecord as loadRecord,
  type ReviewRecord,
  reviewDirectory,
} from "./review-extension-source-record";
import {
  applyingReviews,
  type ReviewState,
  readReviewState,
  readReviewTrees,
  resolutionMap,
  reviewLocalPath,
  reviewSummary,
  saveReviewState,
  withReviewSnapshot,
} from "./review-extension-source-state";
import {
  planExtensionReview,
  readExtensionReviewText,
  readExtensionReviewTree,
  writeExtensionReviewTree,
} from "./review-extension-source-tree";
import {
  assertSameReviewSource,
  type ExtensionReviewSource,
  reviewWorkingCopyChanges,
  StaleExtensionUpgradeReview,
} from "./review-extension-working-copy";

const prepareOriginal = async (ref: string | null, stage: string) => {
  if (!ref) return false;
  try {
    const original = await recoverExtensionUpgradeBaseline(ref, join(stage, "original-download"));
    if (!original) return false;
    const originalPath = join(stage, "base");
    await copyExtensionSource(original, originalPath);
    await readExtensionReviewTree(originalPath);
    return true;
  } catch {
    return false;
  } finally {
    await rm(join(stage, "original-download"), { recursive: true, force: true });
  }
};

export const startExtensionSourceReview = async (
  home: string,
  projectId: string,
  instanceId: string,
  expectedIdentity: string,
  source: ExtensionReviewSource,
  input: InstallExtensionSourceInput,
) => {
  const id = crypto.randomUUID();
  const directory = reviewDirectory(home, id);
  await mkdir(dirname(directory), { recursive: true, mode: 0o700 });
  const stage = await mkdtemp(join(dirname(directory), ".creating-"));
  try {
    const options = { ignoreGit: source.separateProviderId !== undefined };
    const workingFingerprint = fingerprintUpgradeWorkingTree(source.path, options);
    const local = await readExtensionReviewTree(source.path, options);
    assertExtensionUpgradeWorkingTree(source.path, workingFingerprint, options);
    await writeExtensionReviewTree(join(stage, "local"), local);
    const download = join(stage, "release-download");
    const incoming = await resolveInstallSource({ ...input, skipRuntimeBundle: true }, download);
    if (incoming.kind !== "named") throw new Error("A review requires a pinned upstream release.");
    const incomingPath = join(stage, "incoming");
    await copyExtensionSource(incoming.path, incomingPath);
    await rm(download, { recursive: true, force: true });
    const { manifest } = readPackageManifest(incomingPath);
    if (!manifest || canonicalExtensionId(manifest.id) !== canonicalExtensionId(expectedIdentity))
      throw new Error("The selected release has a different extension identity.");
    const record = {
      id,
      projectId,
      instanceId,
      expectedIdentity,
      workingFingerprint,
      sourcePath: source.path,
      sourceRef: source.ref,
      separateProviderId: source.separateProviderId,
      incomingRef: incoming.ref,
      incomingVersion: manifest.version,
      based: await prepareOriginal(source.ref, stage),
      createdAt: new Date().toISOString(),
    };
    const state = readReviewState(stage);
    const summary = reviewSummary(record, state, await readReviewTrees(stage, record, state));
    await writeFile(join(stage, "review.json"), JSON.stringify(record), { mode: 0o600, flag: "wx" });
    await rename(stage, directory);
    return summary;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
};

export const getExtensionSourceReview = async (home: string, id: string, projectId: string, instanceId: string) => {
  const review = await loadRecord(home, id, projectId, instanceId);
  if (!review) return null;
  const { record, directory } = review;
  return withReviewSnapshot(directory, undefined, async (state) => {
    const [trees, changedPaths] = await Promise.all([
      readReviewTrees(directory, record, state),
      reviewWorkingCopyChanges(
        reviewLocalPath(directory, state.snapshot),
        record.sourcePath,
        state.snapshot?.fingerprint ?? record.workingFingerprint,
        Boolean(record.separateProviderId),
      ),
    ]);
    return reviewSummary(record, state, trees, changedPaths);
  });
};

export const findExtensionSourceReview = async (home: string, projectId: string, instanceId: string) => {
  const parent = join(home, "extension-upgrade-reviews");
  const ids = new Bun.Glob("*/review.json").scan({ cwd: parent });
  try {
    for await (const path of ids) {
      const id = dirname(path);
      if (!/^[a-f0-9-]{36}$/.test(id)) continue;
      const review = await getExtensionSourceReview(home, id, projectId, instanceId);
      if (review) return review;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return null;
};

export const saveExtensionSourceReview = async (
  home: string,
  id: string,
  projectId: string,
  instanceId: string,
  revision: string,
  resolutions: ExtensionUpgradeReviewResolution[],
) => {
  const review = await loadRecord(home, id, projectId, instanceId);
  if (!review) return null;
  const { record, directory } = review;
  return withReviewSnapshot(directory, revision, async (current) => {
    const state = { ...current, revision: crypto.randomUUID(), resolutions };
    const summary = reviewSummary(record, state, await readReviewTrees(directory, record, state));
    saveReviewState(directory, revision, state);
    return summary;
  });
};

export { refreshExtensionSourceReview } from "./refresh-extension-source-review";

export const getExtensionSourceReviewFile = async (
  home: string,
  id: string,
  projectId: string,
  instanceId: string,
  path: string,
  revision?: string,
) => {
  const review = await loadRecord(home, id, projectId, instanceId);
  if (!review) return null;
  return withReviewSnapshot(review.directory, revision, async (state) => {
    const trees = await readReviewTrees(review.directory, review.record, state);
    const { changes, result } = planExtensionReview(...trees, resolutionMap(state.resolutions));
    if (!changes.some((change) => change.path === path)) return null;
    const [base, local, incoming] = trees.map((tree) => readExtensionReviewText(tree, path));
    return {
      base: base ?? null,
      local: local ?? null,
      incoming: incoming ?? null,
      proposed: readExtensionReviewText(result, path),
    };
  });
};

export const useExtensionSourceReview = async <T>(
  home: string,
  id: string,
  projectId: string,
  instanceId: string,
  source: ExtensionReviewSource,
  choices: ExtensionUpgradeReviewResolution[],
  options: { usePublished?: boolean; revision: string; validationOnly?: boolean },
  apply: (review: {
    source: { path: string; ref: string };
    upgrade: NonNullable<InstallExtensionSourceInput["reviewedUpgrade"]>;
  }) => Promise<T>,
) => {
  const review = await loadRecord(home, id, projectId, instanceId);
  if (!review) return null;
  const { record, directory } = review;
  if (applyingReviews.has(directory)) throw new ExtensionUpgradeNeedsReviewError("This upgrade is already applying.");
  applyingReviews.add(directory);
  const stage = join(directory, `.applying-${crypto.randomUUID()}`);
  try {
    const result = await withReviewSnapshot(directory, options.revision, (state) =>
      applyReviewPlan(record, state, directory, stage, source, choices, options.usePublished === true, apply),
    );
    // A cleanup error must not turn a committed installation into a failed response.
    if (!options.validationOnly) await rm(directory, { recursive: true, force: true }).catch(() => {});
    return result;
  } finally {
    await rm(stage, { recursive: true, force: true }).catch(() => {});
    applyingReviews.delete(directory);
  }
};

const applyReviewPlan = async <T>(
  record: ReviewRecord,
  state: ReviewState,
  directory: string,
  stage: string,
  source: ExtensionReviewSource,
  choices: ExtensionUpgradeReviewResolution[],
  usePublished: boolean,
  apply: (review: {
    source: { path: string; ref: string };
    upgrade: NonNullable<InstallExtensionSourceInput["reviewedUpgrade"]>;
  }) => Promise<T>,
) => {
  assertSameReviewSource(record, source);
  if (usePublished && !record.separateProviderId) throw new Error("This upgrade replaces a managed working copy.");
  const workingFingerprint = state.snapshot?.fingerprint ?? record.workingFingerprint;
  const changedPaths = await reviewWorkingCopyChanges(
    reviewLocalPath(directory, state.snapshot),
    source.path,
    workingFingerprint,
    Boolean(record.separateProviderId),
  );
  if (changedPaths)
    throw new StaleExtensionUpgradeReview("The local extension changed while this review was open.", changedPaths);
  const trees = await readReviewTrees(directory, record, state);
  const plan = planExtensionReview(...trees, resolutionMap(choices));
  if (!usePublished && plan.unresolved.size)
    throw new ExtensionUpgradeNeedsReviewError("Resolve every conflict before applying the upgrade.");
  await mkdir(stage, { mode: 0o700 });
  const candidatePath = join(stage, "candidate");
  await writeExtensionReviewTree(candidatePath, usePublished ? trees[2] : plan.result);
  const { manifest } = readPackageManifest(candidatePath);
  if (!manifest || canonicalExtensionId(manifest.id) !== canonicalExtensionId(record.expectedIdentity))
    throw new Error("The proposed merge changes the extension identity.");
  if (manifest.version !== record.incomingVersion)
    throw new Error(`Set the manifest version to ${record.incomingVersion} before applying the upgrade.`);
  return apply({
    source: { path: candidatePath, ref: record.incomingRef },
    upgrade: {
      workingFingerprint,
      stagedFingerprint: fingerprintUpgradeWorkingTree(candidatePath),
      originalReleasePath: join(directory, "incoming"),
    },
  });
};

export const cancelExtensionSourceReview = async (home: string, id: string, projectId: string, instanceId: string) => {
  const review = await loadRecord(home, id, projectId, instanceId);
  if (!review) return false;
  if (applyingReviews.has(review.directory))
    throw new ExtensionUpgradeNeedsReviewError("This upgrade is already applying.");
  applyingReviews.add(review.directory);
  try {
    await rm(review.directory, { recursive: true, force: true });
    return true;
  } finally {
    applyingReviews.delete(review.directory);
  }
};
