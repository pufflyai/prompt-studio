import { chmod, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ConnectionSecretStore {
  get(ref: string): Promise<string | null>;
  set(value: string, ref?: string): Promise<string>;
  delete(ref: string): Promise<void>;
  listRefs(): Promise<string[]>;
}

const validRef = (ref: string) => /^[0-9a-f-]{36}$/i.test(ref);

export const createFileConnectionSecretStore = (storageRoot: string): ConnectionSecretStore => {
  const root = join(storageRoot, "extension-connection-secrets");
  const pathFor = (ref: string) => {
    if (!validRef(ref)) throw new Error("Invalid connection secret reference.");
    return join(root, `${ref}.secret`);
  };

  return {
    get: async (ref) => {
      try {
        return await readFile(pathFor(ref), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    set: async (value, existingRef) => {
      const ref = existingRef ?? crypto.randomUUID();
      await mkdir(root, { recursive: true, mode: 0o700 });
      await chmod(root, 0o700);
      const path = pathFor(ref);
      await writeFile(path, value, { encoding: "utf8", mode: 0o600 });
      await chmod(path, 0o600);
      return ref;
    },
    delete: async (ref) => {
      try {
        await unlink(pathFor(ref));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
    listRefs: async () => {
      try {
        const entries = await readdir(root, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".secret"))
          .map((entry) => entry.name.slice(0, -".secret".length))
          .filter(validRef);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    },
  };
};

export const createMemoryConnectionSecretStore = (): ConnectionSecretStore => {
  const secrets = new Map<string, string>();
  return {
    get: async (ref) => secrets.get(ref) ?? null,
    set: async (value, existingRef) => {
      const ref = existingRef ?? crypto.randomUUID();
      secrets.set(ref, value);
      return ref;
    },
    delete: async (ref) => {
      secrets.delete(ref);
    },
    listRefs: async () => [...secrets.keys()],
  };
};
