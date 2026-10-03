import { createHash } from "node:crypto";
import { homedir as osHomedir } from "node:os";
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

// The desktop app serves its local performance snapshot here while monitoring is on.
// Windows has no socket files, so it uses a named pipe derived from the home.
export const resolvePstdioPerformanceEndpoint = (
  input: ResolvePstdioHomeInput = {},
  platform: NodeJS.Platform = process.platform,
) => {
  const home = resolvePstdioHome(input);
  if (platform !== "win32") return join(home, "performance.sock");
  return `\\\\.\\pipe\\pstdio-performance-${createHash("sha256").update(home).digest("hex").slice(0, 16)}`;
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
