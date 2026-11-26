import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { settlePreparedInstall } from "../features/extensions/extension-install-transaction";
import { assertExtensionUpgradeWorkingTree } from "../features/extensions/extension-upgrade-baseline";
import {
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  resolvePstdioHome,
  toExtensionEnableInput,
} from "../features/extensions/install-extension-source";
import {
  cancelExtensionSourceReview,
  type ExtensionReviewSource,
  findExtensionSourceReview,
  getExtensionSourceReview,
  getExtensionSourceReviewFile,
  saveExtensionSourceReview,
  startExtensionSourceReview,
  useExtensionSourceReview,
} from "../features/extensions/review-extension-source";
import { readExtensionReviewRecord } from "../features/extensions/review-extension-source-record";
import type { ExtensionService, ExtensionUpgradeServiceDeps } from "./extension-upgrade-service";

type ExistingInstance = NonNullable<Awaited<ReturnType<ExtensionService["getProjectExtensionInstance"]>>>;
type UpgradeResult = {
  changed: boolean;
  instance: ExistingInstance["instance"];
  installedSource: ExistingInstance["installedSource"];
};
type Destination = {
  installedSourcePath: string;
  upgradeFromVersion: string | null;
  upgradeBase: NonNullable<InstallExtensionSourceInput["upgradeBase"]>;
  repoPath?: string;
};

const reviewedInstallInput = (installName: string, source: { path: string; ref: string | null }) =>
  source.ref === null
    ? { source: source.path }
    : { source: installName, preparedSource: { path: source.path, ref: source.ref } };

export const createExtensionUpgradeReviewService = (input: {
  deps: ExtensionUpgradeServiceDeps;
  install: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>;
  resolveUpgradeInput: (projectId: string, existing: ExistingInstance) => Promise<InstallExtensionSourceInput>;
  registerUpgrade: (existing: ExistingInstance, installed: InstalledExtensionSource) => Promise<UpgradeResult>;
  separateLocalProvider: (
    service: ExtensionService,
    projectId: string,
    existing: ExistingInstance,
  ) => Promise<ExistingInstance | undefined>;
  resolvePublishedInput: (
    extensionId: string,
    source: ExistingInstance["installedSource"],
  ) => Promise<InstallExtensionSourceInput>;
  extensionUpgradeDestination: (
    deps: ExtensionUpgradeServiceDeps,
    projectId: string,
    source: ExistingInstance["installedSource"],
  ) => Promise<Destination>;
}) => {
  const {
    deps,
    install,
    resolveUpgradeInput,
    registerUpgrade,
    separateLocalProvider,
    resolvePublishedInput,
    extensionUpgradeDestination,
  } = input;
  const reviewHome = () => deps.home ?? resolvePstdioHome({ env: process.env });
  const getReviewSource = async (projectId: string, existing: ExistingInstance): Promise<ExtensionReviewSource> => {
    const local = await separateLocalProvider(deps.extensionService, projectId, existing);
    if (local)
      return {
        path: local.installedSource.source_path,
        ref: local.installedSource.source_ref,
        separateProviderId: local.instance.id,
      };
    const { source_path: path, source_ref: ref } = existing.installedSource;
    const keepGitHistory = existing.instance.enabled && existsSync(join(path, ".git"));
    return { path, ref, ...(keepGitHistory && { separateProviderId: existing.instance.id }) };
  };

  const loadOrStartReview = async (projectId: string, instanceId: string) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    const resuming = await findExtensionSourceReview(reviewHome(), projectId, instanceId);
    if (resuming) return resuming;
    const source = await getReviewSource(projectId, existing);
    const identity = existing.installedSource.extension_id;
    const input =
      source.separateProviderId === instanceId && existing.installedSource.source_kind === "local_path"
        ? await resolvePublishedInput(identity, existing.installedSource)
        : await resolveUpgradeInput(projectId, existing);
    return startExtensionSourceReview(
      reviewHome(),
      projectId,
      instanceId,
      identity,
      source,
      input,
      deps.release?.source === "workspace" ? deps.release.root : undefined,
    );
  };

  const beginningReviews = new Map<string, ReturnType<typeof loadOrStartReview>>();
  const beginReview = (projectId: string, instanceId: string) => {
    const key = JSON.stringify([projectId, instanceId]);
    const existing = beginningReviews.get(key);
    if (existing) return existing;
    const pending = loadOrStartReview(projectId, instanceId).finally(() => beginningReviews.delete(key));
    beginningReviews.set(key, pending);
    return pending;
  };

  const installAlongside = async (
    projectId: string,
    source: ExtensionReviewSource & { separateProviderId: string },
    id: string,
    existing: ExistingInstance,
    review: Parameters<Parameters<typeof useExtensionSourceReview>[7]>[0],
  ) => {
    const workspace = await deps.workspaceService.getDefault(projectId);
    const installed = await install({
      ...reviewedInstallInput(existing.installedSource.install_name, review.source),
      installName: `published-${id}`,
      allocateSeparateSource: true,
      repoPath: workspace?.root_path ?? undefined,
      reviewedUpgrade: review.upgrade,
      retainBackup: true,
    });
    try {
      if (resolve(installed.targetPath) === resolve(source.path))
        throw new Error("Published source did not allocate a separate provider.");
      assertExtensionUpgradeWorkingTree(source.path, review.upgrade.workingFingerprint, { ignoreGit: true });
    } catch (error) {
      if (installed.installation) await settlePreparedInstall(installed.installation, false);
      throw error;
    }
    const switched = await deps.extensionService.enableInstalledSourceForProject(
      { projectId, installName: installed.installName, ...toExtensionEnableInput(installed) },
      { expectedProvider: source.separateProviderId },
    );
    return { ...switched, changed: true };
  };

  const validateReview = async (
    projectId: string,
    instanceId: string,
    id: string,
    revision: string,
    choices: Parameters<typeof useExtensionSourceReview>[5],
  ) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    const source = await getReviewSource(projectId, existing);
    const workspace = await deps.workspaceService.getDefault(projectId);
    return useExtensionSourceReview(
      reviewHome(),
      id,
      projectId,
      instanceId,
      source,
      choices,
      { revision, validationOnly: true },
      async ({ source: preparedSource, upgrade: reviewedUpgrade }) => {
        const candidate = await install({
          ...reviewedInstallInput(existing.installedSource.install_name, preparedSource),
          installName: `review-validation-${id}`,
          allocateSeparateSource: true,
          repoPath: workspace?.root_path ?? undefined,
          reviewedUpgrade,
          retainBackup: true,
        });
        if (!candidate.installation) throw new Error("The host could not validate a staged extension.");
        await settlePreparedInstall(candidate.installation, false);
        return { valid: true as const, revision };
      },
    );
  };

  const applyReview = async (
    projectId: string,
    instanceId: string,
    id: string,
    choices: Parameters<typeof useExtensionSourceReview>[5],
    options: Parameters<typeof useExtensionSourceReview>[6],
  ) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    const source = await getReviewSource(projectId, existing);
    const destination = await extensionUpgradeDestination(deps, projectId, existing.installedSource);
    return useExtensionSourceReview(
      reviewHome(),
      id,
      projectId,
      instanceId,
      source,
      choices,
      options,
      async (review) => {
        if (source.separateProviderId)
          return installAlongside(
            projectId,
            { ...source, separateProviderId: source.separateProviderId },
            id,
            existing,
            review,
          );
        return registerUpgrade(
          existing,
          await install({
            ...destination,
            ...reviewedInstallInput(existing.installedSource.install_name, review.source),
            installName: existing.installedSource.install_name,
            reviewedUpgrade: review.upgrade,
            force: true,
            retainBackup: true,
            reuseInstalledDependencies: true,
          }),
        );
      },
    );
  };

  return {
    beginReview,
    projectForReview: async (id: string) => (await readExtensionReviewRecord(reviewHome(), id))?.record.projectId,
    saveReview: (
      projectId: string,
      instanceId: string,
      id: string,
      revision: string,
      resolutions: Parameters<typeof saveExtensionSourceReview>[5],
    ) => saveExtensionSourceReview(reviewHome(), id, projectId, instanceId, revision, resolutions),
    readReview: (projectId: string, instanceId: string, id: string) =>
      getExtensionSourceReview(reviewHome(), id, projectId, instanceId),
    readReviewFile: (projectId: string, instanceId: string, id: string, path: string) =>
      getExtensionSourceReviewFile(reviewHome(), id, projectId, instanceId, path),
    cancelReview: (projectId: string, instanceId: string, id: string) =>
      cancelExtensionSourceReview(reviewHome(), id, projectId, instanceId),
    applyReview,
    validateReview,
  };
};
