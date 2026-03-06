import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { resolveDashboardRoot } from "../../dashboard/resolve-dashboard-root";

const collectFiles = (dir: string, base: string, files: Map<string, Blob>) => {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      collectFiles(fullPath, base, files);
    } else {
      const relPath = relative(base, fullPath);
      const content = readFileSync(fullPath);
      files.set(relPath, new Blob([content]));
    }
  }
};

export const loadFilesystemAssets = () => {
  const assets = new Map<string, Blob>();

  try {
    const root = resolveDashboardRoot(process.cwd());
    collectFiles(root, root, assets);
  } catch {
    // Dashboard not available — serve API only
  }

  return assets;
};
