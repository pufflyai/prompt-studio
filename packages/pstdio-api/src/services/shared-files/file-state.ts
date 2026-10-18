import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import { z } from "zod";
import { fileNode } from "./file-tree";

const projectionSchema = z.record(
  z.string(),
  z.strictObject({ node: fileNode.nullable(), hash: z.string().nullable(), revision: z.string() }),
);
export type FileProjection = z.infer<typeof projectionSchema>;
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
export const fileProjection = (key: string) => {
  const path = join(
    resolvePstdioHome({ env: process.env }),
    "state",
    "artifact-files",
    `${createHash("sha256").update(key).digest("hex")}.json`,
  );
  return {
    async read(): Promise<FileProjection> {
      try {
        return projectionSchema.parse(JSON.parse(await readFile(path, "utf8")));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
        throw error;
      }
    },
    async write(state: FileProjection) {
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${crypto.randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
};
export const blobHash = async (blob: Blob) => {
  const hash = createHash("sha256");
  for await (const chunk of blob.stream()) hash.update(chunk);
  return hash.digest("hex");
};
