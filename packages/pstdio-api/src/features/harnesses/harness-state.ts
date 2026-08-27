import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessStateApi } from "pstdio-api-contracts/extension-kernel";
import { type PstdioPathsEnv, resolvePstdioStatePath } from "pstdio-paths";

const writes = new Map<string, Promise<void>>();

const readValues = async (path: string) => {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Harness state must contain a JSON object: ${path}`);
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
};

const writeValues = async (path: string, values: Record<string, unknown>) => {
  await mkdir(join(path, ".."), { recursive: true });
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(values, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
};

const enqueue = (path: string, action: () => Promise<void>) => {
  const pending = (writes.get(path) ?? Promise.resolve()).then(action, action);
  writes.set(path, pending);
  return pending.finally(() => {
    if (writes.get(path) === pending) writes.delete(path);
  });
};

export const createHarnessStateApi = (extensionId: string, options: { env?: PstdioPathsEnv } = {}): HarnessStateApi => {
  const path = join(resolvePstdioStatePath({ env: options.env }), `${extensionId}.json`);
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
