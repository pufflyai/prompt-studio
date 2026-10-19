export {
  ARTIFACT_MOUNT_ROOT,
  createArtifactMount,
  createFileMount,
  createWorkspaceFilesMount,
  resolveArtifactMountRoot,
} from "./artifact-mount";
export { isPackageAssetDescriptor } from "./asset-validation";
export { type ExtensionStorageOwner, extensionFilesPath } from "./extension-storage-path";
export { globPatternToRegExp } from "./file-glob";
export {
  PackageAssetError,
  type PackageAssetKind,
  type ResolvedPackageAsset,
  readPackageAssetBytes,
  readPackageAssetText,
  resolvePackageAsset,
  resolvePackageAssetPath,
} from "./package-assets";
export { normalizeArtifactMountPath, normalizeCliPath } from "./path-normalization";
export { normalizeMountRelativePath } from "./safe-file-root";
export {
  WorkspaceFileAccessError,
  type WorkspaceMountEntry,
  type WorkspaceMountFile,
  type WorkspaceMountResolvedEntry,
  type WorkspaceMountSearchResult,
} from "./workspace-file-access";
