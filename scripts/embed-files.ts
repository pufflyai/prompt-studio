import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

type CollectFilesOptions = {
  excludeTestFiles?: boolean;
};

const isTestFileName = (fileName: string) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(fileName);

export const collectFiles = (dir: string, options: CollectFilesOptions = {}) => {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);

    if (statSync(fullPath).isDirectory()) {
      files.push(...collectFiles(fullPath, options));
    } else if (!options.excludeTestFiles || !isTestFileName(entry)) {
      files.push(fullPath);
    }
  }

  return files;
};
