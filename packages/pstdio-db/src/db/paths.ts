import fs from "node:fs";
import { expandHomePath, resolvePstdioDbPath } from "pstdio-paths";

export const resolveDbPath = (dbPath?: string) => {
  return expandHomePath(dbPath ?? process.env.PSTDIO_DB_PATH ?? resolvePstdioDbPath());
};

export const ensureDbDirectory = (dbPath: string) => {
  if (dbPath === ":memory:") {
    return;
  }

  fs.mkdirSync(dbPath, { recursive: true });
};
