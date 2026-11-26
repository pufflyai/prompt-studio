import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import type { ExtensionUpgradeReviewResolution } from "pstdio-api-contracts";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import { readPackageManifest } from "pstdio-extensions";
import { withFileMutationLock } from "pstdio-paths";
import { copyExtensionSource } from "./copy-extension-source";
import {
  assertExtensionUpgradeWorkingTree,
  ExtensionUpgradeNeedsReviewError,
  recoverExtensionUpgradeBaseline,
} from "./extension-upgrade-baseline";
import { fingerprintUpgradeWorkingTree } from "./extension-upgrade-working-tree";
import type { InstallExtensionSourceInput } from "./install-extension-source-types";
import { resolveInstallSource } from "./resolve-install-source";
import { type ReviewRecord, readExtensionReviewRecord, reviewDirectory } from "./review-extension-source-record";
import {
  planExtensionReview,
  readExtensionReviewText,
  readExtensionReviewTree,
  writeExtensionReviewTree,
} from "./review-extension-source-tree";
import { reviewWorkingCopyChanges, StaleExtensionUpgradeReview } from "./review-extension-working-copy";

export type ExtensionReviewSource = {
  path: string;
  ref: string | null;
  separateProviderId?: string;
};

const applyingReviews = new Set<string>();

const loadRecord = async (home: string, id: string, projectId: string, instanceId: string) => {
  const review = await readExtensionReviewRecord(home, id);
  const record = review?.record;
  return record?.projectId === projectId && record.instanceId === instanceId ? review : null;
};

const loadTrees = (directory: string, based: boolean) =>
  Promise.all([
    based ? readExtensionReviewTree(join(directory, "base")) : undefined,
    readExtensionReviewTree(join(directory, "local")),
    readExtensionReviewTree(join(directory, "incoming")),
  ] as const);

type ReviewChoices = { revision: string; resolutions: ExtensionUpgradeReviewResolution[] };
const choicesFile = (directory: string) => join(directory, "choices.json");

const readChoices = (directory: string): ReviewChoices => {
  try {
    return JSON.parse(readFileSync(choicesFile(directory), "utf8")) as ReviewChoices;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { revision: "initial", resolutions: [] };
  }
};

const assertRevision = (directory: string, revision: string) => {
  if (readChoices(directory).revision !== revision)
    throw new ExtensionUpgradeNeedsReviewError("Another view saved resolutions. Reopen the review to load them.");
};

const resolutionMap = (choices: ExtensionUpgradeReviewResolution[]) => {
  const totalTextBytes = choices.reduce(
    (size, choice) => size + (choice.kind === "text" ? Buffer.byteLength(choice.text) : 0),
    0,
  );
  if (totalTextBytes > 16 * 1024 * 1024) throw new Error("The staged text resolutions are too large.");
  const resolutions = new Map(choices.map((choice) => [choice.path, choice]));
  if (resolutions.size !== choices.length) throw new Error("A path has more than one upgrade resolution.");
  return resolutions;
};

const reviewSummary = (record: ReviewRecord, choices: ReviewChoices, trees: Awaited<ReturnType<typeof loadTrees>>) => ({
  id: record.id,
  incomingVersion: record.incomingVersion,
  hasOriginal: record.based,
  separateLocalProvider: record.separateProviderId !== undefined,
  localPath: record.sourcePath,
  createdAt: record.createdAt,
  ...choices,
  changes: planExtensionReview(...trees, resolutionMap(choices.resolutions)).changes,
});

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
  workspaceRoot?: string,
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
    if (incoming.kind !== "named") {
      if (!source.separateProviderId || !workspaceRoot) throw new Error("A review requires a pinned upstream release.");
      const path = relative(await realpath(workspaceRoot), await realpath(incoming.path));
      if (!path || isAbsolute(path) || path === ".." || path.startsWith(`..${sep}`))
        throw new Error("The review candidate must belong to the running workspace.");
    }
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
      incomingRef: incoming.kind === "named" ? incoming.ref : null,
      incomingVersion: manifest.version,
      based: await prepareOriginal(source.ref, stage),
      createdAt: new Date().toISOString(),
    };
    const summary = reviewSummary(record, readChoices(stage), await loadTrees(stage, record.based));
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
  const [trees, changedPaths] = await Promise.all([
    loadTrees(directory, record.based),
    reviewWorkingCopyChanges(
      directory,
      record.sourcePath,
      record.workingFingerprint,
      Boolean(record.separateProviderId),
    ),
  ]);
  return { ...reviewSummary(record, readChoices(directory), trees), changedPaths };
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
  const choices = { revision: crypto.randomUUID(), resolutions };
  const summary = reviewSummary(record, choices, await loadTrees(directory, record.based));
  const file = choicesFile(directory);
  withFileMutationLock(file, () => {
    if (applyingReviews.has(directory)) throw new ExtensionUpgradeNeedsReviewError("This upgrade is already applying.");
    assertRevision(directory, revision);
    const stage = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      writeFileSync(stage, JSON.stringify(choices), { mode: 0o600, flag: "wx" });
      renameSync(stage, file);
    } finally {
      rmSync(stage, { force: true });
    }
  });
  return summary;
};

export const getExtensionSourceReviewFile = async (
  home: string,
  id: string,
  projectId: string,
  instanceId: string,
  path: string,
) => {
  const review = await loadRecord(home, id, projectId, instanceId);
  if (!review) return null;
  const trees = await loadTrees(review.directory, review.record.based);
  const { changes, result } = planExtensionReview(...trees, resolutionMap(readChoices(review.directory).resolutions));
  if (!changes.some((change) => change.path === path)) return null;
  const [base, local, incoming] = trees.map((tree) => readExtensionReviewText(tree, path));
  return {
    base: base ?? null,
    local: local ?? null,
    incoming: incoming ?? null,
    proposed: readExtensionReviewText(result, path),
  };
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
    source: { path: string; ref: string | null };
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
    assertRevision(directory, options.revision);
    const result = await applyReviewPlan(
      record,
      directory,
      stage,
      source,
      choices,
      options.usePublished === true,
      apply,
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
  directory: string,
  stage: string,
  source: ExtensionReviewSource,
  choices: ExtensionUpgradeReviewResolution[],
  usePublished: boolean,
  apply: (review: {
    source: { path: string; ref: string | null };
    upgrade: NonNullable<InstallExtensionSourceInput["reviewedUpgrade"]>;
  }) => Promise<T>,
) => {
  if (
    source.path !== record.sourcePath ||
    source.ref !== record.sourceRef ||
    source.separateProviderId !== record.separateProviderId
  )
    throw new StaleExtensionUpgradeReview("The active extension source changed while this review was open.");
  if (usePublished && !record.separateProviderId) throw new Error("This upgrade replaces a managed working copy.");
  const changedPaths = await reviewWorkingCopyChanges(
    directory,
    source.path,
    record.workingFingerprint,
    Boolean(record.separateProviderId),
  );
  if (changedPaths)
    throw new StaleExtensionUpgradeReview("The local extension changed while this review was open.", changedPaths);
  const trees = await loadTrees(directory, record.based);
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
      workingFingerprint: record.workingFingerprint,
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
  await rm(review.directory, { recursive: true, force: true });
  return true;
};
