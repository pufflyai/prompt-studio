import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const pending = new Map<string, Promise<unknown>>();

export function instanceDirectory(root: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid PocketCoder instance ID.");
  return join(root, id);
}

export async function writeJson(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, path);
}

export async function serializeState<T>(path: string, action: () => Promise<T>) {
  const key = resolve(path);
  const run = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
  pending.set(key, run);
  try {
    return await run;
  } finally {
    if (pending.get(key) === run) pending.delete(key);
  }
}
