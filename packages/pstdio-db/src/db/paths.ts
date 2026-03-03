import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const defaultDbPath = path.join(os.homedir(), ".pstdio", "pstdio.db");

const expandHomeDirectory = (value: string) => {
  if (value === "~") {
    return os.homedir();
  }

  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
};

export const resolveDbPath = (dbPath?: string) => {
  return expandHomeDirectory(dbPath ?? process.env.PSTDIO_DB_PATH ?? defaultDbPath);
};

export const ensureDbDirectory = (dbPath: string) => {
  if (dbPath === ":memory:") {
    return;
  }

  fs.mkdirSync(dbPath, { recursive: true });
};
