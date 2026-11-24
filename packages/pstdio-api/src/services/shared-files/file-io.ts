import { mkdir, rename, rm, rmdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { AssetOwner, AssetReference } from "pstdio-api-contracts";
import { historicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import {
  type ArtifactMountWriteObserver,
  createSafeFileRoot,
  filesystemIdentity,
  observeArtifactParentWrite,
} from "pstdio-extensions";
import type { createAssetTransferService } from "../asset-transfer-service";
import { blobHash } from "./file-state";

export interface FileIdentity {
  kind: "file" | "directory" | null;
  hash: string | null;
}
export const sameFile = (a: FileIdentity, b: FileIdentity) => a.kind === b.kind && a.hash === b.hash;
export const absentFile: FileIdentity = { kind: null, hash: null };

export const createFileProjectionIO = (input: {
  root: string;
  packageRoot: string;
  roots: string[];
  owner: AssetOwner;
  local: ArtifactMount;
  assets: ReturnType<typeof createAssetTransferService>;
  signal?: AbortSignal;
  beforeWrite?: () => Promise<unknown>;
  onWrite?: ArtifactMountWriteObserver;
}) => {
  const safe = createSafeFileRoot(input.root);
  const boundaries = input.roots
    .slice()
    .sort((a, b) => a.length - b.length)
    .map((path) => ({ path, safe: createSafeFileRoot(join(input.root, path)) }));
  const boundary = (path: string) => {
    const root = boundaries.find((root) => path === root.path || path.startsWith(`${root.path}/`));
    return root ? { safe: root.safe, path: path.slice(root.path.length + 1) } : { safe, path };
  };
  const scratch = createSafeFileRoot(input.packageRoot);
  const source = async (path: string) => {
    try {
      const target = boundary(path);
      const resolved = await target.safe.tryResolveExisting(target.path);
      if (!resolved) return null;
      const info = await stat(resolved.operationPath);
      if (info.isDirectory()) return { kind: "directory" as const, hash: null, file: null };
      if (!info.isFile()) return null;
      const file = Bun.file(resolved.operationPath);
      return { kind: "file" as const, file, hash: await blobHash(file) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOTDIR") return null;
      throw error;
    }
  };
  const unchanged = async (path: string, expected: FileIdentity) =>
    sameFile((await source(path)) ?? absentFile, expected);
  const clearOldKind = async (path: string, target: FileIdentity, expected: FileIdentity) => {
    const scoped = boundary(path);
    const existing = await scoped.safe.tryResolveExisting(scoped.path);
    if (!existing || target.kind === expected.kind) return true;
    if (expected.kind === "file") await input.local.delete(path);
    if (expected.kind === "directory") {
      try {
        await rmdir(existing.operationPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOTEMPTY") return false;
        throw error;
      }
    }
    return true;
  };
  const place = async (
    path: string,
    target: FileIdentity,
    temporary: string | undefined,
    parentWrite?: ReturnType<typeof observeArtifactParentWrite>,
  ) => {
    const scoped = boundary(path);
    const requestedPath = join(input.root, path);
    if (!target.kind) {
      input.onWrite?.(requestedPath, undefined, parentWrite?.());
      return;
    }
    const createdDirectories = input.onWrite ? new Map<string, string>() : undefined;
    const destination = await scoped.safe.resolveForWrite(
      scoped.path,
      createdDirectories && ((folder, identity) => createdDirectories.set(folder, identity)),
    );
    const changedPath = join(requestedPath, relative(destination.operationPath, destination.realPath));
    const observedParent =
      input.onWrite && dirname(requestedPath) !== dirname(changedPath)
        ? observeArtifactParentWrite(changedPath)
        : parentWrite;
    if (target.kind === "directory") {
      const created = await mkdir(destination.operationPath, { recursive: true });
      if (created && createdDirectories) {
        const stats = await stat(destination.operationPath, { bigint: true }).catch(() => undefined);
        if (stats?.isDirectory()) createdDirectories.set(changedPath, filesystemIdentity(stats));
      }
    } else if (temporary) await rename(temporary, destination.realPath);
    input.onWrite?.(changedPath, createdDirectories, observedParent?.());
  };
  const install = async (
    path: string,
    target: FileIdentity,
    asset: AssetReference | null | undefined,
    expected: FileIdentity,
    content?: Blob,
  ) => {
    await input.beforeWrite?.();
    const temporary =
      asset || content ? await scratch.resolveForWrite(`.publishers/pstdio-shared-files/${crypto.randomUUID()}`) : null;
    try {
      if (temporary && (asset || content))
        await Bun.write(
          temporary.operationPath,
          content ? new Response(content) : new Response(await input.assets.read(input.owner, asset!, input.signal)),
        );
      // A download must not overwrite an editor save made while the transfer was in flight.
      await input.beforeWrite?.();
      if (!(await unchanged(path, expected))) return false;
      const parentWrite = input.onWrite && observeArtifactParentWrite(join(input.root, path));
      if (!(await clearOldKind(path, target, expected))) return false;
      await place(path, target, temporary?.operationPath, parentWrite);
      return true;
    } finally {
      if (temporary) await rm(temporary.operationPath, { force: true });
    }
  };
  const previousOwner = historicalExtensionId(input.owner.extensionId);
  const identityRoot =
    previousOwner === input.owner.extensionId ? input.root : join(dirname(input.root), previousOwner);
  return { source, install, projectionKey: (path: string) => JSON.stringify(["artifact-file", identityRoot, path]) };
};
