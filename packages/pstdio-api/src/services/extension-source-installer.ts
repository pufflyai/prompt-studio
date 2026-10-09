import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { InstallExtensionRequest, UploadExtensionRequest } from "pstdio-api-contracts";
import type { ExtensionCatalogEntry } from "../features/extensions/extension-catalog";
import {
  type InstallExtensionSourceInput,
  prepareGitExtensionSource,
} from "../features/extensions/install-extension-source";
import {
  InvalidExtensionFolderError,
  installLocalExtensionFolder,
} from "../features/extensions/local-extension-folder";
import { ProjectNotFoundError } from "./extension-service";
import type { ExtensionUpgradeServiceDeps } from "./extension-upgrade-service";

interface ExtensionSourceInstallerDeps {
  deps: ExtensionUpgradeServiceDeps;
  install: NonNullable<ExtensionUpgradeServiceDeps["installExtensionSource"]>;
  catalogEntry: (name: string) => Promise<ExtensionCatalogEntry | undefined>;
  releaseRefFor: (entry: ExtensionCatalogEntry) => string;
}
type ProjectFolderSource = Extract<InstallExtensionRequest["source"], { kind: "project-folder" }>;
type CatalogSource = Extract<InstallExtensionRequest["source"], { kind: "catalog" }>;

const projectSourcePath = (repoPath: string | undefined, path: string) => {
  if (!repoPath) throw new InvalidExtensionFolderError("This project has no local folder.");
  if (isAbsolute(path) || path.includes("\\") || path.split("/").some((part) => part === ".." || part === "")) {
    throw new InvalidExtensionFolderError("Source must be a path inside the host project folder.");
  }
  const root = realpathSync(repoPath);
  const candidate = resolve(root, path);
  if (!existsSync(candidate))
    throw new InvalidExtensionFolderError("Source folder does not exist in the host project.");
  const source = realpathSync(candidate);
  const rel = relative(root, source);
  if (rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel)) {
    throw new InvalidExtensionFolderError("Source leaves the host project folder.");
  }
  return source;
};

export const createExtensionSourceInstaller = (input: ExtensionSourceInstallerDeps) => {
  const { deps, install, catalogEntry, releaseRefFor } = input;
  const installCatalog = async (source: CatalogSource, options: Omit<InstallExtensionSourceInput, "source">) => {
    const entry = await catalogEntry(source.name);
    if (!entry) throw new ProjectNotFoundError(source.name);
    const ref = source.ref ?? releaseRefFor(entry);
    const workspaceSource = !source.ref && deps.release?.source === "workspace" && entry.origin.ref === "{hostRelease}";
    const sourcePath =
      workspaceSource && deps.release?.source === "workspace"
        ? join(deps.release.root, entry.origin.path)
        : source.name;
    return install({
      ...options,
      source: sourcePath,
      installName: options.installName ?? source.name,
      ref,
      hostReleaseRef: deps.release?.ref,
      ...(workspaceSource
        ? { skipInstall: true }
        : {
            prepareNamedSource: (_name, tempDir, explicitRef, signal) =>
              prepareGitExtensionSource(entry.origin, tempDir, explicitRef ?? ref, signal),
          }),
    });
  };
  const installProjectFolder = (source: ProjectFolderSource, options: Omit<InstallExtensionSourceInput, "source">) =>
    install({
      ...options,
      source: projectSourcePath(options.repoPath, source.path),
      ...(source.development ? { force: true, reuseInstalledDependencies: true } : {}),
    });
  return async (projectId: string, request: InstallExtensionRequest | UploadExtensionRequest) => {
    const workspace = await deps.workspaceService.getDefault(projectId);
    if (!workspace) throw new ProjectNotFoundError(projectId);
    const options = {
      installName: request.installName,
      force: request.force,
      skipInstall: request.skipInstall,
      repoPath: workspace.execution_kind === "local" ? (workspace.root_path ?? undefined) : undefined,
    };
    if ("kind" in request)
      return installLocalExtensionFolder({
        name: request.folderName,
        files: request.files,
        install,
        options: { ...options, ...(request.development ? { force: true, reuseInstalledDependencies: true } : {}) },
      });
    if (request.source.kind === "project-folder") return installProjectFolder(request.source, options);
    return installCatalog(request.source, options);
  };
};
