import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { type ArtifactFileProjection, artifactFileProjectionSchema } from "pstdio-api-contracts";
import type { createExtensionStorageDBService } from "pstdio-db";
import { resolvePstdioHome } from "pstdio-paths";
import type { StorageOwner } from "pstdio-sync";

export type FileProjection = ArtifactFileProjection;
const pending = new Map<string, Promise<unknown>>();
export const serializeFiles = <T>(key: string, action: () => Promise<T>) => {
  const result = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
  pending.set(key, result);
  const forget = () => {
    if (pending.get(key) === result) pending.delete(key);
  };
  void result.then(forget, forget);
  return result;
};
export const artifactProjectionKey = (owner: StorageOwner, repoRoot: string) =>
  JSON.stringify([
    { workbenchId: owner.workbenchId, extensionId: owner.extensionId },
    resolve(repoRoot, ".pstdio/extension-storage", owner.extensionId),
  ]);
export const projectionAddress = (key: string) => {
  const hash = createHash("sha256").update(key).digest("hex");
  return { key: hash, path: join(resolvePstdioHome({ env: process.env }), "state", "artifact-files", `${hash}.json`) };
};
export const fileProjection = (
  key: string,
  projections: ReturnType<typeof createExtensionStorageDBService>["fileProjections"],
) => {
  const address = projectionAddress(key);
  const indexed = projections.open(address.key);
  const read = async (paths?: string[], descendantsOf?: string) => {
    const result = await indexed.read(paths, descendantsOf);
    if (!result.initialized && (await Bun.file(address.path).exists()))
      throw new Error("This file's local state needs repair. See the startup log and restart Prompt Studio.");
    return artifactFileProjectionSchema.parse(result.state);
  };
  return {
    read,
    async write(changes: FileProjection) {
      await read([]);
      await indexed.write(artifactFileProjectionSchema.parse(changes));
    },
  };
};
export const blobHash = async (blob: Blob) => {
  const hash = createHash("sha256");
  for await (const chunk of blob.stream()) hash.update(chunk);
  return hash.digest("hex");
};
