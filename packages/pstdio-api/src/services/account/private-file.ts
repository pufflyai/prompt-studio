import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { z } from "zod";

export const readPrivateFile = async <T>(path: string, schema: z.ZodType<T>, empty: T) => {
  try {
    return schema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw new Error("Invalid native account configuration");
  }
};

export const writePrivateFile = async (path: string, value: unknown) => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
};

const queues = new Map<string, Promise<unknown>>();
export const serializeNativeWrite = <T>(path: string, action: () => Promise<T>) => {
  const result = (queues.get(path) ?? Promise.resolve()).catch(() => {}).then(action);
  queues.set(path, result);
  void result
    .finally(() => {
      if (queues.get(path) === result) queues.delete(path);
    })
    .catch(() => {});
  return result;
};
