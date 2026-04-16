import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isCompiledBinary } from "../commands/serve/embedded-assets";
import { resolveDefaultDbPath, resolveDefaultStoragePath } from "./state-paths";

type ApiSpawnOptions = {
  cwd?: string;
  stdio: "inherit" | "ignore";
  detached?: boolean;
  env?: NodeJS.ProcessEnv;
};

type ApiChildProcess = {
  on?: (event: string, listener: (code: number | null) => void) => ApiChildProcess;
  unref?: () => void;
  kill?: (signal?: NodeJS.Signals | number) => boolean;
};

type ApiSpawner = (command: string, args: readonly string[], options: ApiSpawnOptions) => ApiChildProcess;

type ApiLaunchOptions = {
  spawner?: ApiSpawner;
  env?: NodeJS.ProcessEnv;
  stdio?: ApiSpawnOptions["stdio"];
  detached?: boolean;
  bundledCliPath?: string;
};

const readApiPackageName = (apiRoot: string) => {
  try {
    const raw = readFileSync(join(apiRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { name?: string };
    return parsed.name ?? null;
  } catch {
    return null;
  }
};

const isApiWorkspace = (apiRoot: string) => readApiPackageName(apiRoot) === "pstdio-api";

export const resolveApiRoot = (startDir: string) => {
  let current = resolve(startDir);

  while (true) {
    const candidate = join(current, "packages", "pstdio-api");
    if (isApiWorkspace(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

export const resolveBundledApiEntry = (cliEntryPath: string) => {
  const cliDir = dirname(resolve(cliEntryPath));
  const candidate = join(cliDir, "api", "server.js");

  if (existsSync(candidate)) {
    return candidate;
  }

  return null;
};

const resolveCliEntryPath = () => {
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return null;
  }
};

const buildCompiledApiCommand = (stdio: ApiSpawnOptions["stdio"] = "ignore", detached = true) => ({
  command: process.execPath,
  args: ["serve"],
  options: { cwd: undefined as string | undefined, stdio, detached },
});

export const buildApiStartCommand = (apiRoot: string, stdio: ApiSpawnOptions["stdio"] = "ignore", detached = true) => ({
  command: "bun",
  args: ["run", "start"],
  options: { cwd: apiRoot, stdio, detached },
});

const buildBundledApiCommand = (serverEntry: string, stdio: ApiSpawnOptions["stdio"] = "ignore", detached = true) => ({
  command: "node",
  args: [serverEntry],
  options: { cwd: undefined as string | undefined, stdio, detached },
});

export const shouldAutoStartApi = (env: NodeJS.ProcessEnv = process.env) => env.PSTDIO_DISABLE_API_AUTO_START !== "1";

const resolveApiEnv = (env: NodeJS.ProcessEnv) => {
  const resolved = { ...env };

  if (!resolved.PSTDIO_API_PORT) {
    return resolved;
  }

  resolved.PORT = resolved.PSTDIO_API_PORT;

  return resolved;
};

const resolveWorkspaceFilesRoot = (apiRoot: string) => join(dirname(apiRoot), "pstdio", "files");

const resolveApiRuntimeEnv = (env: NodeJS.ProcessEnv, filesRoot?: string) => {
  const resolved = resolveApiEnv(env);

  if (!resolved.PSTDIO_DB_PATH) {
    resolved.PSTDIO_DB_PATH = resolveDefaultDbPath();
  }

  if (!resolved.PSTDIO_STORAGE_PATH) {
    resolved.PSTDIO_STORAGE_PATH = resolveDefaultStoragePath();
  }

  if (!resolved.PSTDIO_FILES_ROOT && filesRoot) {
    resolved.PSTDIO_FILES_ROOT = filesRoot;
  }

  return resolved;
};

export const runApi = (startDir: string, options: ApiLaunchOptions = {}) => {
  const { spawner = spawn, env = process.env, stdio = "ignore", detached = true, bundledCliPath } = options;

  if (!shouldAutoStartApi(env)) {
    return null;
  }

  // Path 1: compiled binary — self-spawn with `serve` subcommand
  if (isCompiledBinary()) {
    const compiledEnv = resolveApiRuntimeEnv(env);
    const { command, args, options: spawnOptions } = buildCompiledApiCommand(stdio, detached);
    const child = spawner(command, args, { ...spawnOptions, env: compiledEnv });

    if (detached) {
      child.unref?.();
    }

    return { apiRoot: null, child };
  }

  // Path 2: workspace mode — spawn `bun run start` in pstdio-api
  const cliPath = bundledCliPath ?? resolveCliEntryPath();
  const apiRoot = resolveApiRoot(startDir) ?? (cliPath ? resolveApiRoot(dirname(resolve(cliPath))) : null);

  if (apiRoot) {
    const { command, args, options: spawnOptions } = buildApiStartCommand(apiRoot, stdio, detached);
    const child = spawner(command, args, {
      ...spawnOptions,
      env: resolveApiRuntimeEnv(env, resolveWorkspaceFilesRoot(apiRoot)),
    });

    if (detached) {
      child.unref?.();
    }

    return { apiRoot, child };
  }

  // Path 3: bundled mode — spawn `node dist/api/server.js`
  const bundledEntry = cliPath ? resolveBundledApiEntry(cliPath) : null;

  if (bundledEntry) {
    const bundledEnv = resolveApiRuntimeEnv(env);
    const { command, args, options: spawnOptions } = buildBundledApiCommand(bundledEntry, stdio, detached);
    const child = spawner(command, args, { ...spawnOptions, env: bundledEnv });

    if (detached) {
      child.unref?.();
    }

    return { apiRoot: null, child };
  }

  return null;
};
