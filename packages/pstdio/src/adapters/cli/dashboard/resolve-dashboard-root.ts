import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const resolveWorkspaceDashboardDist = (startDir: string) => {
  let current = resolve(startDir);

  while (true) {
    const candidate = join(current, "packages", "pstdio-dashboard", "dist");
    if (existsSync(join(candidate, "index.html"))) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

const resolveCliEntryPath = () => {
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return null;
  }
};

export const resolveDashboardRoot = (startDir: string, bundledCliPath?: string) => {
  const workspaceRoot = resolveWorkspaceDashboardDist(startDir);
  if (workspaceRoot) return workspaceRoot;

  const cliPath = bundledCliPath ?? resolveCliEntryPath();
  if (cliPath) {
    const sourceWorkspaceRoot = resolveWorkspaceDashboardDist(dirname(resolve(cliPath)));
    if (sourceWorkspaceRoot) return sourceWorkspaceRoot;

    const bundled = join(dirname(resolve(cliPath)), "dashboard");
    if (existsSync(join(bundled, "index.html"))) return bundled;
  }

  throw new Error(
    "Dashboard assets not found next to the pstdio CLI. Reinstall pstdio to restore them, or run `bun run build` first when you are running pstdio from a source checkout.",
  );
};
