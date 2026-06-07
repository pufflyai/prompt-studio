export {
  type CheckExtensionsInput,
  type CheckExtensionsResult,
  checkExtensions,
  formatCheckReport,
} from "./check";
export { buildCliHelpTree, type CliHelpNode } from "./cli-help";
export { toCommandPaletteContributions } from "./command-palette-contributions";
export {
  type DetectPackageManagerResult,
  detectPackageManager,
  type PackageManager,
} from "./detect-package-manager";
export { createDiagnostic } from "./diagnostics";
export {
  discoverExtensionPackages,
  discoverExtensionPackagesInUserRoot,
  pstdioExtensionsRoot,
  pstdioHomeRoot,
} from "./discovery";
export {
  type DependencyInstallReport,
  ExtensionInstallError,
  type FetchGithubExtensionInput,
  type InstallExtensionDeps,
  type InstallExtensionInput,
  type InstallExtensionResult,
  type InstalledExtensionRecord,
  type InstallSourceKind,
  installExtensionSource,
  type ResolvedInstallSource,
} from "./install";
export {
  type ExtensionPackageRef,
  type LoadExtensionSourcesOptions,
  type LoadedExtensionSource,
  loadExtensionPackage,
  loadExtensionSources,
} from "./loader";
export { normalizeExtensionSources } from "./normalize";
export { keybindingDedupeEntries } from "./normalize/keybindings";
export {
  type ExtensionLoadScope,
  type PackageManifest,
  type ReadPackageManifestResult,
  readPackageManifest,
} from "./package-manifest";
export {
  isPackageManagerOnPath,
  type RunPackageInstallOptions,
  type RunPackageInstallResult,
  runPackageInstall,
} from "./run-package-install";
export {
  type BuildEnvironmentInput,
  type CommandExecuteInput,
  type CommandRunner,
  type CommandRunnerEnvironment,
  type CommandRunnerHostDeps,
  createCommandRunner,
  DEFAULT_MAX_COMMAND_DEPTH,
  type HostCommandExecuteInput,
} from "./runner";
export { type LoadExtensionRuntimeInput, loadExtensionRuntime } from "./runtime";
