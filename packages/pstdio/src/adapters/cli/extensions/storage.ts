import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CommandStorage } from "@pstdio/sdk/plugins";

const readStateFile = (filePath: string): Record<string, unknown> => {
  if (!existsSync(filePath)) return {};

  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
};

const writeStateFile = (filePath: string, values: Record<string, unknown>) => {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(values, null, 2)}\n`);
};

export const createExtensionStorage = (repoPath: string | null, extensionId: string): CommandStorage => {
  if (!repoPath) {
    return {
      get: async () => undefined,
      set: async () => {},
    };
  }

  const filePath = join(repoPath, ".pstdio", "extensions", ".storage", `${extensionId}.json`);

  return {
    async get<T>(key: string) {
      const values = readStateFile(filePath);
      return values[key] as T | undefined;
    },

    async set(key: string, value: unknown) {
      const values = readStateFile(filePath);
      values[key] = value;
      writeStateFile(filePath, values);
    },
  };
};
