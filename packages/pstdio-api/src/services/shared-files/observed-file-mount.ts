import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { normalizeMountRelativePath } from "pstdio-extensions";
import { serializeFiles } from "./file-state";
import {
  assertStorageVersion,
  commitStorageVersion,
  isObservingStorage,
  observeStorageVersion,
} from "./storage-observation";

const bytesRevision = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const absentRevision = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR") return "missing";
  if (code === "EISDIR") return "directory";
};
const fileRevision = async (mount: ArtifactMount, path: string) => {
  try {
    return bytesRevision(await mount.readBytes(path));
  } catch (error) {
    const revision = absentRevision(error);
    if (revision) return revision;
    throw error;
  }
};

/** The native loader and saver observe the same bytes even when the source is a workspace file. */
export const createObservedFileMount = (root: string, mount: ArtifactMount): ArtifactMount => {
  const keyFor = (path: string) => JSON.stringify(["workspace-file", resolve(root), normalizeMountRelativePath(path)]);
  const readBytes = async (path: string) => {
    try {
      const bytes = await mount.readBytes(path);
      if (isObservingStorage()) observeStorageVersion(keyFor(path), bytesRevision(bytes));
      return bytes;
    } catch (error) {
      const revision = absentRevision(error);
      if (revision && isObservingStorage()) observeStorageVersion(keyFor(path), revision);
      throw error;
    }
  };
  const write = <T>(path: string, action: () => Promise<T>, revision: () => string) => {
    const key = keyFor(path);
    return serializeFiles(key, async () => {
      if (isObservingStorage()) assertStorageVersion(key, await fileRevision(mount, path));
      const value = await action();
      if (isObservingStorage()) commitStorageVersion(key, revision());
      return value;
    });
  };
  return {
    ...mount,
    exists: async (path) => {
      const found = await mount.exists(path);
      if (isObservingStorage())
        observeStorageVersion(keyFor(path), found ? await fileRevision(mount, path) : "missing");
      return found;
    },
    readBytes,
    readText: (path) =>
      isObservingStorage() ? readBytes(path).then((bytes) => new TextDecoder().decode(bytes)) : mount.readText(path),
    writeText: (path, value) =>
      write(
        path,
        () => mount.writeText(path, value),
        () => bytesRevision(new TextEncoder().encode(value)),
      ),
    updateText: (path, value) =>
      write(
        path,
        () => mount.updateText(path, value),
        () => bytesRevision(new TextEncoder().encode(value)),
      ),
    writeBytes: (path, value) => {
      const bytes = new Uint8Array(value);
      return write(
        path,
        () => mount.writeBytes(path, bytes),
        () => bytesRevision(bytes),
      );
    },
    delete: (path) =>
      write(
        path,
        () => mount.delete(path),
        () => "missing",
      ),
  };
};
