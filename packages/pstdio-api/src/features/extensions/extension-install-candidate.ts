import type { PreparedExtensionRevision } from "pstdio-extensions";
import { retainPreparedRevision } from "pstdio-extensions/prepared-cache";
import { traceSetupPhase } from "../../lib/setup-phase";
import { checkFailed } from "./extension-install-errors";
import {
  checkExtensionSource,
  hashExtensionSource,
  type LoadedExtension,
  readExtensionSourceMetadata,
} from "./extension-runtime";
import { classifyWebviewEntry, collectExtensionWebviews } from "./extension-webviews";
import type { InstallExtensionSourceInput } from "./install-extension-source-types";
import { prepareInstallDependencies } from "./prepare-extension-dependencies";
import { importPreparedReleaseBundle } from "./prepared-release-bundle";
import type { resolveInstallSource } from "./resolve-install-source";
import { validateExtensionWebviews } from "./validate-extension-webviews";

export const validatePreparedInstall = async (
  installPath: string,
  extensionsRoot: string,
  allowUnsupportedApiVersion: boolean,
  preparedRevision?: PreparedExtensionRevision,
) => {
  const { check, loaded: compatibleSource } = await checkExtensionSource(installPath, extensionsRoot, {
    preparedRevision,
  });
  const unsupportedApiOnly =
    check.errorCount > 0 &&
    check.diagnostics
      .filter((diagnostic) => diagnostic.severity === "error")
      .every((diagnostic) => diagnostic.code === "extension_manifest_unsupported_api_version");
  const keepForRecovery = allowUnsupportedApiVersion && unsupportedApiOnly;
  if (check.errorCount > 0 && !keepForRecovery) throw checkFailed(check);

  const loaded: LoadedExtension | null =
    compatibleSource ?? (keepForRecovery ? readExtensionSourceMetadata(installPath) : null);
  if (!loaded) throw checkFailed(check);

  if (keepForRecovery && check.extensions.length === 0) {
    check.extensions.push({
      id: loaded.metadata.id,
      name: loaded.metadata.name,
      displayName: loaded.metadata.displayName,
      sourcePath: installPath,
      version: loaded.metadata.version,
      description: loaded.metadata.description,
    });
  }

  return { check, loaded };
};

interface InstallCandidate {
  input: InstallExtensionSourceInput;
  installPath: string;
  targetPath: string;
  extensionsRoot: string;
  installName: string;
  source: Awaited<ReturnType<typeof resolveInstallSource>>;
  preserveExistingSource: boolean;
}

const prepareFromBundle = async (candidate: InstallCandidate) => {
  const { input, source, installPath, extensionsRoot } = candidate;
  if (candidate.preserveExistingSource || source.kind !== "named") return;
  input.signal?.throwIfAborted();
  const sourceHash = hashExtensionSource(installPath);
  const revision = await traceSetupPhase(
    "extension.import_bundle",
    { extension: candidate.installName, warmed: Boolean(source.preparedRelease) },
    async () => {
      if (source.preparedRelease?.sourceHash === sourceHash) {
        retainPreparedRevision(source.preparedRelease);
        return source.preparedRelease;
      }
      if (source.runtimeBundle) return importPreparedReleaseBundle(source.runtimeBundle, installPath, sourceHash);
    },
  );
  if (!revision) throw new Error("The cached runtime bundle does not match the extension source.");
  const result = await traceSetupPhase("extension.validate_bundle", { extension: candidate.installName }, () =>
    validatePreparedInstall(installPath, extensionsRoot, false, revision),
  );
  const views = collectExtensionWebviews(result.loaded).filter(
    (view) => classifyWebviewEntry(view.entry).kind === "managed",
  );
  if (
    Object.keys(revision.webviews ?? {}).length !== views.length ||
    views.some((view) => !revision.webviews?.[view.id])
  )
    throw new Error("Extension runtime bundle does not contain the declared managed webviews.");
  const linkedInstalledDependencies = await prepareInstallDependencies({
    installInput: { ...input, skipInstall: true },
    installPath,
    source,
    targetPath: candidate.targetPath,
  });
  return { ...result, sourceHash, linkedInstalledDependencies };
};

export const prepareInstallCandidate = async (candidate: InstallCandidate) => {
  const { input, source, installPath, targetPath, extensionsRoot, installName } = candidate;
  const context = { extension: installName };
  if (
    !candidate.preserveExistingSource &&
    source.kind === "named" &&
    (source.runtimeBundle || source.preparedRelease)
  ) {
    const prepared = await traceSetupPhase("extension.prebuilt_runtime", context, () => prepareFromBundle(candidate));
    if (prepared) return prepared;
  }

  const linkedInstalledDependencies = await traceSetupPhase("extension.prepare_dependencies", context, () =>
    prepareInstallDependencies({ installInput: input, installPath, source, targetPath }),
  );
  input.signal?.throwIfAborted();
  const checked = await traceSetupPhase("extension.validate", context, () =>
    validatePreparedInstall(installPath, extensionsRoot, input.allowUnsupportedApiVersion === true),
  );
  input.signal?.throwIfAborted();
  await validateExtensionWebviews(checked.loaded, installPath, installName, input.signal);
  const sourceHash = await traceSetupPhase("extension.source_hash", context, async () =>
    hashExtensionSource(installPath),
  );
  return { ...checked, sourceHash, linkedInstalledDependencies };
};
