export {
  type CheckExtensionsInput,
  type CheckExtensionsResult,
  checkExtensions,
  formatCheckReport,
} from "./check";
export { buildCliHelpTree, type CliHelpNode } from "./cli-help";
export { toCommandPaletteContributions } from "./command-palette-contributions";
export { createDiagnostic } from "./diagnostics";
export {
  discoverExtensionPackages,
  discoverExtensionPackagesInUserRoot,
  pstdioExtensionsRoot,
  pstdioHomeRoot,
} from "./discovery";
export {
  checkExtensionHostCompatibility,
  dashboardExtensionHostCapabilities,
} from "./host-capabilities";
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
  findFirstReservedKeybindingConflict,
  findReservedKeybindingConflict,
  findReservedKeybindingConflicts,
  listReservedKeybindings,
  type ReservedKeybindingMatch,
  type ReservedKeybindingPlatform,
  type ReservedKeybindingReason,
} from "./normalize/reserved-keybindings";
export {
  type ExtensionLoadScope,
  getExtensionApiVersionError,
  type PackageManifest,
  type ReadPackageManifestResult,
  readPackageManifest,
  readPackageManifestMetadata,
} from "./package-manifest";
export { createExtensionInstallEnvironment, createExtensionProcessEnvironment } from "./process-environment";
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
