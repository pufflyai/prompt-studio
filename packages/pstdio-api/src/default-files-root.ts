import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const resolveWorkspaceFilesRoot = () => {
  const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const filesRoot = join(packageRoot, "..", "pstdio", "files");

  return existsSync(filesRoot) ? filesRoot : "";
};

export const resolveApiFilesRoot = (env: Record<string, string | undefined> = process.env) => {
  const configured = env.PSTDIO_FILES_ROOT?.trim();
  if (configured) return configured;

  return resolveWorkspaceFilesRoot();
};
