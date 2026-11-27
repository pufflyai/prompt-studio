import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { isPreparationHost } from "pstdio-extensions";
import { preparationBuildConcurrency, withPreparationBuildCommand } from "pstdio-extensions/preparation-command";
import { isPackagedRuntime } from "pstdio-paths";
import { runExtensionPreparation } from "./extension-preparation";
import { deferWebviewEquationStyles } from "./extension-webview-equation-styles";
import { emitWebviewFonts } from "./extension-webview-fonts";
import { runCommand } from "./install-extension-dependencies";

import { extensionWebviewBuildOptions } from "./webview-build-options";

export { extensionWebviewBuildOptions } from "./webview-build-options";

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

type WebviewBuildInput = Omit<ExtensionWebviewBuildInput, "entryPath"> & {
  entryPaths: string[];
  metafilePath?: string;
};

const buildArguments = (input: WebviewBuildInput, entryNaming: string, metafilePath: string) => {
  const options = extensionWebviewBuildOptions;
  return [
    "build",
    ...input.entryPaths,
    `--outdir=${input.outdir}`,
    `--target=${options.target}`,
    `--format=${options.format}`,
    ...(options.minify ? ["--minify"] : []),
    ...(options.splitting ? ["--splitting"] : []),
    `--metafile=${metafilePath}`,
    `--entry-naming=${entryNaming}`,
    `--chunk-naming=${options.naming.chunk}`,
    `--asset-naming=${options.naming.asset}`,
    ...Object.entries(options.define).map(([name, value]) => `--define=${name}=${value}`),
  ];
};

// Builds and fresh input inspectors share these leaf slots. Never hold a slot around
// preparation orchestration: its nested inspection/build calls need the same pool.
const buildSlots = preparationBuildConcurrency;
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

export const withExtensionWebviewBuildSlot = async <T>(work: () => Promise<T>): Promise<T> => {
  await acquireBuildSlot();
  try {
    return await withPreparationBuildCommand(work);
  } finally {
    releaseBuildSlot();
  }
};

// A long-running Bun process keeps package resolutions it has already read, so an in-process
// build cannot see a replaced extension folder. Each build runs in a new Bun process (ADR 0070).
const runBuild = async (input: WebviewBuildInput, entryNaming: string) => {
  if (input.signal.aborted) return { success: false, details: "Build aborted." };
  const metafilePath = input.metafilePath ?? `${input.outdir}.metafile-${crypto.randomUUID()}.json`;

  try {
    const result = await withExtensionWebviewBuildSlot(async () => {
      if (input.signal.aborted) return { exitCode: 1, stdout: "", stderr: "Build aborted." };
      return runCommand(process.execPath, buildArguments(input, entryNaming, metafilePath), {
        cwd: dirname(input.entryPaths[0]!),
        env: { ...process.env, NO_COLOR: "1", ...(isPackagedRuntime() ? { BUN_BE_BUN: "1" } : {}) },
        signal: input.signal,
      });
    });

    if (input.signal.aborted) return { success: false, details: "Build aborted." };
    if (result.exitCode === 0) {
      deferWebviewEquationStyles(input.outdir, metafilePath);
      emitWebviewFonts(input.outdir);
      return { success: true, details: "" };
    }
    return { success: false, details: result.stderr.trim() || result.stdout.trim() || "Webview build failed." };
  } finally {
    if (!input.metafilePath) rmSync(metafilePath, { force: true });
  }
};

export const buildExtensionWebview: ExtensionWebviewBuilder = (input) => {
  if (isPreparationHost)
    return runExtensionPreparation(
      "webview.build",
      { entryPath: input.entryPath, outdir: input.outdir },
      { signal: input.signal },
    );
  return runBuild(
    { outdir: input.outdir, signal: input.signal, entryPaths: [input.entryPath] },
    extensionWebviewBuildOptions.naming.entry,
  );
};

/** One fresh process validates the complete replacement and shares its common module graph. */
export const buildExtensionWebviewBatch = (input: WebviewBuildInput) => runBuild(input, "[dir]/[name].[ext]");
