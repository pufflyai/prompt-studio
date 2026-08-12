export type { ExtensionsCheckResponse } from "pstdio-api-contracts";
export {
  checkExtensionSource,
  formatExtensionsCheck,
  hashExtensionSource,
  type LoadedExtension,
} from "./extension-runtime";
export {
  type CreateExtensionSourceWatcherInput,
  createExtensionSourceWatcher,
  type ExtensionSourceWatcher,
} from "./extension-source-watcher";
export { extensionDependencyInputNames, hashExtensionDependencyInputs } from "./hash-extension-dependency-inputs";
export {
  type DependencyInstallInput,
  installDependencies,
  shouldInstallDependencies,
} from "./install-extension-dependencies";

import { type InstallExtensionSourceInput, installExtensionSource } from "./install-extension-source";

export type SyncExtensionDevelopmentSourceInput = Omit<
  InstallExtensionSourceInput,
  "existsOk" | "force" | "reuseInstalledDependencies" | "saveLockfile" | "skipInstall"
>;

export const syncExtensionDevelopmentSource = (input: SyncExtensionDevelopmentSourceInput) =>
  installExtensionSource({
    ...input,
    force: true,
    reuseInstalledDependencies: true,
    saveLockfile: false,
  });
