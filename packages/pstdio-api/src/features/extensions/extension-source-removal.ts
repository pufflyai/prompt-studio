import { rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { resolvePstdioHome } from "./install-extension-source";

const isManagedInstalledSourcePath = (sourcePath: string) => {
  const extensionsRoot = resolve(join(resolvePstdioHome({ env: process.env }), "extensions"));
  const relativePath = relative(extensionsRoot, resolve(sourcePath));
  return relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);
};

// Repo-local removal must delete its folder, or the next sync reinstalls it.
const isRepoLocalSourcePath = (sourcePath: string) => {
  const resolvedSourcePath = resolve(sourcePath);
  const marker = `${sep}.pstdio${sep}extensions${sep}`;
  const markerIndex = resolvedSourcePath.indexOf(marker);
  return markerIndex > 0 && resolvedSourcePath.length > markerIndex + marker.length;
};

// Run on the preparation worker: its synchronous source hashing cannot interleave
// with this synchronous recursive deletion. Queued callbacks see a missing root.
export const removeInstalledSourceFiles = (sourcePath: string) => {
  if (!isManagedInstalledSourcePath(sourcePath) && !isRepoLocalSourcePath(sourcePath)) return;
  rmSync(sourcePath, { recursive: true, force: true });
};
