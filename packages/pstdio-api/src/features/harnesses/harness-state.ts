import { constants } from "node:fs";
import { lstat, mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessStateApi } from "pstdio-api-contracts/extension-kernel";
import { extensionStorageDirectory } from "pstdio-extensions";
import { type PstdioPathsEnv, resolvePstdioStatePath } from "pstdio-paths";

const writes = new Map<string, Promise<void>>();

const secureDirectory = async (path: string) => {
  if (process.platform === "win32") {
    if (!(await lstat(path)).isDirectory()) throw new Error("Harness state requires a real directory.");
    return;
  }
  const directory = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    await directory.chmod(0o700);
  } finally {
    await directory.close();
  }
};

const readValues = async (path: string) => {
  try {
    await secureDirectory(join(path, ".."));
    if (process.platform === "win32" && (await lstat(path)).isSymbolicLink())
      throw new Error("Harness state cannot be a symbolic link.");
    const flags = process.platform === "win32" ? "r" : constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
    const file = await open(path, flags);
    try {
      if (!(await file.stat()).isFile()) throw new Error("Harness state must be a regular file.");
      if (process.platform !== "win32") await file.chmod(0o600);
      const value = JSON.parse(await file.readFile("utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Harness state must contain a JSON object: ${path}`);
      }
      return value as Record<string, unknown>;
    } finally {
      await file.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
};

const writeValues = async (path: string, values: Record<string, unknown>) => {
  const directory = join(path, "..");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await secureDirectory(directory);
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(values, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

const enqueue = (path: string, action: () => Promise<void>) => {
  const pending = (writes.get(path) ?? Promise.resolve()).then(action, action);
  writes.set(path, pending);
  return pending.finally(() => {
    if (writes.get(path) === pending) writes.delete(path);
  });
};

export const createHarnessStateApi = (extensionId: string, options: { env?: PstdioPathsEnv } = {}): HarnessStateApi => {
  const path = join(resolvePstdioStatePath({ env: options.env }), `${extensionStorageDirectory(extensionId)}.json`);
  return {
    get: async (key) => (await readValues(path))[key] as never,
    set: (key, value) =>
      enqueue(path, async () => {
        const values = await readValues(path);
        values[key] = value;
        await writeValues(path, values);
      }),
    delete: (key) =>
      enqueue(path, async () => {
        const values = await readValues(path);
        delete values[key];
        await writeValues(path, values);
      }),
  };
};
