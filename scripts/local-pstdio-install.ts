import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const BIN_NAME = "pstdio";
const CLI_ENTRY = "packages/pstdio/src/index.ts";
const MANAGED_MARKER = "# managed-by=pstdio-local-checkout";
const LEGACY_MANAGED_MARKER = "// managed-by=pstdio-local-checkout";
const REPO_MARKER = "# repo-root=";
const LEGACY_REPO_MARKER = "// repo-root=";
const BACKUP_SUFFIX = ".pstdio-local-backup";

type LocalPstdioInput = {
  installDir: string;
  repoRoot: string;
};

type InstallLocalPstdioInput = LocalPstdioInput & {
  mode?:
    | {
        type: "checkout";
      }
    | {
        apiUrl: string;
        type: "dev-server";
      };
  pathEnv?: string | undefined;
};

const canWrite = (path: string) => {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const isPathEntry = (pathEnv: string | undefined, installDir: string) => {
  if (!pathEnv) return false;
  return pathEnv.split(":").includes(installDir);
};

const resolveExistingCommandPath = (pathEnv: string | undefined) => {
  if (!pathEnv) return null;

  for (const installDir of pathEnv.split(":")) {
    if (!installDir) continue;

    const destination = join(installDir, BIN_NAME);

    if (existsSync(destination)) {
      return destination;
    }
  }

  return null;
};

const getBackupPath = (destination: string) => `${destination}${BACKUP_SUFFIX}`;

const quoteShellValue = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;

const createWrapper = (repoRoot: string, mode: NonNullable<InstallLocalPstdioInput["mode"]>) => {
  const cliPath = join(repoRoot, CLI_ENTRY);
  const envLines =
    mode.type === "dev-server"
      ? [
          `export PSTDIO_API_URL=${quoteShellValue(mode.apiUrl)}`,
          "export PSTDIO_DISABLE_API_AUTO_START='1'",
          "export PSTDIO_DISABLE_EMBED_MANIFEST='1'",
        ]
      : [];

  return `#!/bin/sh
${MANAGED_MARKER}
${REPO_MARKER}${repoRoot}
${envLines.join("\n")}
exec bun ${quoteShellValue(cliPath)} "$@"
`;
};

const readManagedRepoRoot = (path: string) => {
  const content = readFileSync(path, "utf8");
  if (!content.includes(MANAGED_MARKER) && !content.includes(LEGACY_MANAGED_MARKER)) return null;

  const repoLine = content
    .split("\n")
    .find((line) => line.startsWith(REPO_MARKER) || line.startsWith(LEGACY_REPO_MARKER));

  if (!repoLine) return null;
  return repoLine.startsWith(REPO_MARKER)
    ? repoLine.slice(REPO_MARKER.length)
    : repoLine.slice(LEGACY_REPO_MARKER.length);
};

export const resolveLocalPstdioInstallDir = (pathEnv?: string) => {
  const existingCommandPath = resolveExistingCommandPath(pathEnv);

  if (existingCommandPath && canWrite(dirname(existingCommandPath))) {
    return dirname(existingCommandPath);
  }

  if (canWrite("/usr/local/bin")) return "/usr/local/bin";
  return join(homedir(), ".local", "bin");
};

export const installLocalPstdio = ({
  installDir,
  mode = { type: "checkout" },
  pathEnv,
  repoRoot,
}: InstallLocalPstdioInput) => {
  mkdirSync(installDir, { recursive: true });

  const destination = join(installDir, BIN_NAME);
  const backupPath = getBackupPath(destination);
  const previousRepoRoot = existsSync(destination) ? readManagedRepoRoot(destination) : null;

  if (existsSync(destination) && !previousRepoRoot) {
    if (existsSync(backupPath)) {
      throw new Error(`Refusing to overwrite unmanaged pstdio install at ${destination}`);
    }

    renameSync(destination, backupPath);
  }

  writeFileSync(destination, createWrapper(repoRoot, mode));
  chmodSync(destination, 0o755);

  return {
    destination,
    needsPathUpdate: !isPathEntry(pathEnv, installDir),
    previousRepoRoot,
  };
};

export const removeLocalPstdio = ({ installDir, repoRoot }: LocalPstdioInput) => {
  const destination = join(installDir, BIN_NAME);
  const backupPath = getBackupPath(destination);

  if (!existsSync(destination)) {
    return { destination, reason: "missing" as const, removed: false };
  }

  const installedRepoRoot = readManagedRepoRoot(destination);

  if (!installedRepoRoot) {
    throw new Error(`Refusing to remove unmanaged pstdio install at ${destination}`);
  }

  if (installedRepoRoot !== repoRoot) {
    return {
      destination,
      installedRepoRoot,
      reason: "different-checkout" as const,
      removed: false,
    };
  }

  if (existsSync(backupPath)) {
    rmSync(destination);
    renameSync(backupPath, destination);
    return { destination, removed: true, restoredBackup: true };
  }

  rmSync(destination);
  return { destination, removed: true };
};
