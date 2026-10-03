import { createHash } from "node:crypto";
import { homedir as osHomedir, tmpdir as osTmpdir } from "node:os";
import { join, resolve } from "node:path";

export type PstdioPathsEnv = Record<string, string | undefined> & {
  HOME?: string | undefined;
  PSTDIO_HOME?: string | undefined;
};

type ResolvePstdioHomeInput = {
  env?: PstdioPathsEnv;
  homedir?: () => string;
  homedirPath?: string;
};

const resolveUserHome = (input: ResolvePstdioHomeInput = {}) => {
  const envHome = input.env?.HOME?.trim();
  if (envHome) return envHome;

  return input.homedirPath ?? input.homedir?.() ?? osHomedir();
};

export const expandHomePath = (value: string, homePath = resolveUserHome()) => {
  if (value === "~") return homePath;
  if (value.startsWith("~/")) return join(homePath, value.slice(2));

  return value;
};

export const normalizeEmbeddedFileName = (value: string) => value.replaceAll("\\", "/");

export const resolvePstdioHome = (input: ResolvePstdioHomeInput = {}) => {
  const env = input.env ?? process.env;
  const homePath = resolveUserHome({ ...input, env });
  const configured = env.PSTDIO_HOME?.trim();

  return resolve(expandHomePath(configured || join(homePath, ".pstdio"), homePath));
};

export const resolvePstdioDbPath = (input: ResolvePstdioHomeInput = {}) => join(resolvePstdioHome(input), "pstdio.db");

export const resolvePstdioLogPath = (input: ResolvePstdioHomeInput = {}) =>
  join(resolvePstdioHome(input), "logs.jsonl");

export const resolvePstdioRuntimeDescriptorPath = (input: ResolvePstdioHomeInput = {}) =>
  join(resolvePstdioHome(input), "runtime.json");

// Unix socket paths are limited to about 104 bytes, including the terminator.
const MAX_SOCKET_PATH_BYTES = 100;

// The desktop app serves its local performance snapshot here while monitoring is on.
// Windows has no socket files, so it uses a named pipe derived from the home. A home
// too long for a socket path uses the user's temporary directory instead.
export const resolvePstdioPerformanceEndpoint = (
  input: ResolvePstdioHomeInput = {},
  platform: NodeJS.Platform = process.platform,
  tempDirectory = osTmpdir(),
) => {
  const home = resolvePstdioHome(input);
  const id = createHash("sha256").update(home).digest("hex").slice(0, 16);
  if (platform === "win32") return `\\\\.\\pipe\\pstdio-performance-${id}`;
  const inHome = join(home, "performance.sock");
  if (Buffer.byteLength(inHome) <= MAX_SOCKET_PATH_BYTES) return inHome;
  return join(tempDirectory, `pstdio-performance-${id}.sock`);
};

export const resolvePstdioStatePath = (input: ResolvePstdioHomeInput = {}) => join(resolvePstdioHome(input), "state");

export const resolvePstdioStoragePath = (input: ResolvePstdioHomeInput = {}) =>
  join(resolvePstdioHome(input), "storage");

export const resolvePstdioWorkspacesPath = (input: ResolvePstdioHomeInput = {}) =>
  join(resolvePstdioHome(input), "workspaces");

// True when running inside a Bun `--compile`d standalone binary (embedded files present).
export const isPackagedRuntime = () => {
  try {
    const embeddedFiles = (globalThis as { Bun?: { embeddedFiles?: unknown } }).Bun?.embeddedFiles;
    return Array.isArray(embeddedFiles) && embeddedFiles.length > 0;
  } catch {
    return false;
  }
};
