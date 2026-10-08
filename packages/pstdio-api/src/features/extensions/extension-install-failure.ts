import { basename, dirname } from "node:path";
import { ExtensionNameConflictError, ProjectNotFoundError } from "../../services/extension-service";
import { ExtensionUpgradeUnavailableError } from "../../services/extension-upgrade-unavailable-error";
import { checkExtensionSource, hashExtensionSource } from "./extension-runtime";
import {
  ExtensionAlreadyInstalledError,
  ExtensionValidationFailedError,
  formatAlreadyInstalledMessage,
  RepoScopedExtensionNeedsProjectFolderError,
} from "./install-extension-source";
import { InvalidExtensionFolderError } from "./local-extension-folder";

const existingSource = async (targetPath: string) => {
  const { check, loaded } = await checkExtensionSource(targetPath, dirname(targetPath));
  if (!loaded) return { targetPath };
  const metadata = loaded;
  return {
    check,
    installName: basename(targetPath),
    metadata: metadata.metadata,
    manifest: metadata.manifest,
    sourceHash: hashExtensionSource(targetPath),
    targetPath,
    source: { kind: "local", path: targetPath },
  };
};

export const extensionInstallFailure = async (error: unknown) => {
  if (error instanceof InvalidExtensionFolderError) return { body: { error: error.message }, status: 400 as const };
  if (error instanceof ProjectNotFoundError) return { body: { error: error.message }, status: 404 as const };
  if (error instanceof ExtensionAlreadyInstalledError)
    return {
      body: {
        error: formatAlreadyInstalledMessage(error),
        code: "extension_already_installed",
        source: await existingSource(error.targetPath),
      },
      status: 409 as const,
    };
  if (error instanceof RepoScopedExtensionNeedsProjectFolderError)
    return {
      body: { error: error.message, code: "extension_project_folder_required" },
      status: 409 as const,
    };
  if (error instanceof ExtensionValidationFailedError)
    return {
      body: { error: error.firstError, code: "extension_invalid", diagnostics: error.diagnostics },
      status: 422 as const,
    };
  if (error instanceof ExtensionNameConflictError || error instanceof ExtensionUpgradeUnavailableError)
    return {
      body: { error: error.message },
      status: 409 as const,
    };
  return null;
};
