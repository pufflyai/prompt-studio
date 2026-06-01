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

export const resolvePstdioHome = (input: ResolvePstdioHomeInput = {}) => {
  const env = input.env ?? process.env;
  const homePath = resolveUserHome({ ...input, env });
  const configured = env.PSTDIO_HOME?.trim();

  return resolve(expandHomePath(configured || join(homePath, ".pstdio"), homePath));
};

export const resolvePstdioDbPath = (input: ResolvePstdioHomeInput = {}) => join(resolvePstdioHome(input), "pstdio.db");

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
