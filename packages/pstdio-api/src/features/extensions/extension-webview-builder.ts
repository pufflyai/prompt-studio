import { availableParallelism } from "node:os";
import { dirname } from "node:path";
import { isPackagedRuntime } from "pstdio-paths";
import { runCommand } from "./install-extension-dependencies";

export const extensionWebviewBuildOptions = {
  target: "browser",
  format: "esm",
  splitting: true,
  define: { "process.env.NODE_ENV": '"production"' },
  minify: true,
  naming: { entry: "module.[ext]", chunk: "chunk-[hash].[ext]", asset: "[name]-[hash].[ext]" },
} satisfies Partial<Bun.BuildConfig>;

export type ExtensionWebviewBuildInput = {
  entryPath: string;
  outdir: string;
  signal: AbortSignal;
};

export type ExtensionWebviewBuildResult = {
  details: string;
  success: boolean;
};

export type ExtensionWebviewBuilder = (input: ExtensionWebviewBuildInput) => Promise<ExtensionWebviewBuildResult>;

export type ExtensionWebviewBatchBuildInput = Omit<ExtensionWebviewBuildInput, "entryPath"> & { entryPaths: string[] };

const buildArguments = (input: ExtensionWebviewBatchBuildInput, entryNaming: string) => {
  const options = extensionWebviewBuildOptions;
  return [
    "build",
    ...input.entryPaths,
    `--outdir=${input.outdir}`,
    `--target=${options.target}`,
    `--format=${options.format}`,
    ...(options.minify ? ["--minify"] : []),
    ...(options.splitting ? ["--splitting"] : []),
    `--entry-naming=${entryNaming}`,
    `--chunk-naming=${options.naming.chunk}`,
    `--asset-naming=${options.naming.asset}`,
    ...Object.entries(options.define).map(([name, value]) => `--define=${name}=${value}`),
  ];
};

// Each build process needs several hundred megabytes, and a host upgrade rebuilds every webview at
// startup, so only a few builds run at once.
const buildSlots = Math.max(1, Math.min(4, availableParallelism()));
let runningBuilds = 0;
const waitingBuilds: (() => void)[] = [];

const acquireBuildSlot = async () => {
  if (runningBuilds < buildSlots) {
    runningBuilds++;
    return;
  }
  // A finished build hands its slot to the next waiting build.
  await new Promise<void>((resolve) => waitingBuilds.push(resolve));
};

const releaseBuildSlot = () => {
  const next = waitingBuilds.shift();
  if (next) next();
  else runningBuilds--;
};

// A long-running Bun process keeps package resolutions it has already read, so an in-process
// build cannot see a replaced extension folder. Each build runs in a new Bun process (ADR 0070).
const runBuild = async (input: ExtensionWebviewBatchBuildInput, entryNaming: string) => {
  if (input.signal.aborted) return { success: false, details: "Build aborted." };

  await acquireBuildSlot();
  let result: Awaited<ReturnType<typeof runCommand>>;
  try {
    if (input.signal.aborted) return { success: false, details: "Build aborted." };
    result = await runCommand(process.execPath, buildArguments(input, entryNaming), {
      cwd: dirname(input.entryPaths[0]!),
      env: { ...process.env, NO_COLOR: "1", ...(isPackagedRuntime() ? { BUN_BE_BUN: "1" } : {}) },
      signal: input.signal,
    });
  } finally {
    releaseBuildSlot();
  }

  if (input.signal.aborted) return { success: false, details: "Build aborted." };
  if (result.exitCode === 0) return { success: true, details: "" };
  return { success: false, details: result.stderr.trim() || result.stdout.trim() || "Webview build failed." };
};

export const buildExtensionWebview: ExtensionWebviewBuilder = (input) =>
  runBuild(
    { outdir: input.outdir, signal: input.signal, entryPaths: [input.entryPath] },
    extensionWebviewBuildOptions.naming.entry,
  );

/** One fresh process validates the complete replacement and shares its common module graph. */
export const buildExtensionWebviewBatch = (input: ExtensionWebviewBatchBuildInput) =>
  runBuild(input, "[dir]/[name].[ext]");
