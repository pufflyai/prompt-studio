import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { installExtensionSource, removePathBestEffort } from "./install-extension-source";

export class InvalidExtensionFolderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidExtensionFolderError";
  }
}

// Paths come from the browser, so they are only accepted in one plain form: forward slashes, no
// drive letter, and no empty, "." or ".." segment. Such a path cannot leave the folder on any platform.
const isPlainRelativePath = (path: string) =>
  !path.includes("\\") &&
  !/^[a-zA-Z]:/.test(path) &&
  path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");

const assertValidFolder = (name: string, files: File[]) => {
  if (!isPlainRelativePath(name) || name.includes("/")) {
    throw new InvalidExtensionFolderError(`Invalid extension folder name: ${name}`);
  }
  const escaping = files.find((file) => !isPlainRelativePath(file.name));
  if (escaping) throw new InvalidExtensionFolderError(`File path leaves the extension folder: ${escaping.name}`);
  if (!files.some((file) => file.name === "package.json")) {
    throw new InvalidExtensionFolderError(`Extension folder "${name}" has no package.json.`);
  }
};

/**
 * Writes a dropped folder to a scratch copy, then installs that copy into the project's
 * `.pstdio/extensions` the same way `pst extensions add <path>` does: dependencies, validation,
 * and an atomic move into place that refuses to replace an existing folder.
 */
export const installLocalExtensionFolder = async (input: { name: string; files: File[]; repoPath: string }) => {
  assertValidFolder(input.name, input.files);
  const uploadRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-upload-"));

  try {
    const source = join(uploadRoot, input.name);
    for (const file of input.files) {
      const target = join(source, file.name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, new Uint8Array(await file.arrayBuffer()));
    }

    return await installExtensionSource({
      source,
      installName: input.name,
      repoPath: input.repoPath,
      // The drop zone promises a project-local copy, whatever scope the manifest declares.
      scope: "repo",
    });
  } finally {
    removePathBestEffort(uploadRoot);
  }
};
