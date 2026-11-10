import { runExtensionPreparation } from "./extension-preparation";
import "./extension-preparation";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isPreparationHost, type PreparationOptions } from "pstdio-extensions";
import { ExtensionRegistryError } from "pstdio-extensions/distribution";
import { GitUnavailableError } from "pstdio-wt";
import {
  ExtensionAlreadyInstalledError,
  ExtensionValidationFailedError,
  isLocalExtensionSource,
  prepareAndInstallExtensionSource,
  RepoScopedExtensionNeedsProjectFolderError,
  resolvePstdioHome,
} from "./extension-install-preparation";
import { extensionInstallResources } from "./extension-install-resources";
import { claimPreparedInstall } from "./extension-install-transaction";
import type { InstallExtensionSourceInput, InstalledExtensionSource } from "./install-extension-source-types";

export {
  checkExtensionsRoot,
  dashboardExtensionHostCapabilities,
  EXTENSION_INSTALLING_MARKER,
  ExtensionAlreadyInstalledError,
  ExtensionValidationFailedError,
  formatAlreadyInstalledMessage,
  formatExtensionsCheck,
  isLocalExtensionSource,
  RepoScopedExtensionNeedsProjectFolderError,
  removePathBestEffort,
  resolvePstdioHome,
  toExtensionEnableInput,
} from "./extension-install-preparation";
export {
  createSharedNamedSourceCheckout,
  namedSourceRef,
  prepareGitExtensionSource,
  prepareReleaseExtensionSource,
} from "./extension-source-checkout";
export type {
  ExtensionEnableInput,
  InstallExtensionSourceInput,
  InstalledExtensionSource,
} from "./install-extension-source-types";

type InstallTransport = (data: unknown, options: PreparationOptions) => Promise<InstalledExtensionSource>;
const prepareInstall: InstallTransport = (data, options) => runExtensionPreparation("install", data, options);
export const installExtensionSource = async (
  input: InstallExtensionSourceInput,
  transport: InstallTransport = prepareInstall,
): Promise<InstalledExtensionSource> => {
  // Function injection is an authoring/test seam. All production source specifications are data
  // and use the shared preparation worker, including CLI callers that do not create an API app.
  if (!isPreparationHost || input.runCommand || input.isPackagedRuntime) return prepareAndInstallExtensionSource(input);
  const { signal, homedir, prepareNamedSource, runCommand: _run, isPackagedRuntime: _packaged, ...data } = input;
  let callbackRoot: string | undefined;
  try {
    if (prepareNamedSource && !isLocalExtensionSource(input.source)) {
      callbackRoot = await mkdtemp(join(tmpdir(), "pstdio-extension-checkout-"));
      data.preparedSource = await prepareNamedSource(
        input.source,
        callbackRoot,
        input.ref,
        signal,
        input.hostReleaseRef,
      );
    }
    signal?.throwIfAborted();
    const installed = await transport(
      { ...data, env: { ...(input.env ?? process.env), PSTDIO_HOME: resolvePstdioHome(input) } },
      { signal, home: resolvePstdioHome(input), resources: extensionInstallResources(input) },
    );
    if (installed.installation) claimPreparedInstall(installed.installation);
    return installed;
  } catch (error) {
    if (error instanceof Error) {
      const type = [
        ExtensionAlreadyInstalledError,
        ExtensionValidationFailedError,
        RepoScopedExtensionNeedsProjectFolderError,
        ExtensionRegistryError,
        GitUnavailableError,
      ].find((type) => type.name === error.name);
      if (type) Object.setPrototypeOf(error, type.prototype);
    }
    throw error;
  } finally {
    if (callbackRoot) await rm(callbackRoot, { recursive: true, force: true });
  }
};
