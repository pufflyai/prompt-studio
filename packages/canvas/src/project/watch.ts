import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type CanvasBuildOptions, isCurrent, readManifest, resolveOut, resolveRoot } from "./build";
import { listCanvasFiles } from "./discover";
import { inputPath } from "./inputs";
import type { CanvasBuildManifest } from "./manifest";

const CLI = resolve(import.meta.dir, "../../bin/pstdio-canvas.ts");

export interface CanvasWatchOptions extends Omit<CanvasBuildOptions, "force"> {
  /** How often to check the last build's files for changes. */
  intervalMs?: number;
  /** Called after each build with the build's exit code. */
  onBuild?: (exitCode: number) => void;
}

// The files a build depends on, with their modification times. A failed build is retried only
// after this changes, so a broken setup never rebuilds in a loop.
const inputState = async (root: string, manifest: CanvasBuildManifest | undefined) => {
  const files = [
    ...(await listCanvasFiles(root)).map((file) => join(root, file)),
    join(root, "package.json"),
    ...Object.keys(manifest?.inputs ?? {}).map((key) => inputPath(root, key)),
  ];
  const times = await Promise.all(files.map(async (file) => (await stat(file).catch(() => undefined))?.mtimeMs));
  return JSON.stringify(files.map((file, index) => [file, times[index]]));
};

/**
 * Rebuilds the canvases whenever a canvas file or an input of the last build changes.
 *
 * It checks the last build's own inputs instead of registering a recursive `fs.watch`: on Linux
 * that walks every folder, including `node_modules` symlinks (lesson 0012). Each build runs in a
 * new Bun process, because a long-running process keeps package resolutions it has already read
 * and would miss newly installed packages.
 */
export const watchCanvases = (options: CanvasWatchOptions) => {
  const root = resolveRoot(options.root);
  const out = resolveOut(root, options.out);
  let stopped = false;
  let failedState: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let child: ReturnType<typeof Bun.spawn> | undefined;
  const build = async () => {
    child = Bun.spawn([process.execPath, CLI, "build", "--root", root, "--out", out], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await child.exited;
    child = undefined;
    options.onBuild?.(exitCode);
    return exitCode;
  };
  const check = async () => {
    const manifest = await readManifest(out);
    if (!stopped && !(manifest && (await isCurrent(root, manifest)))) {
      const state = await inputState(root, manifest);
      if (state !== failedState) failedState = (await build()) === 0 ? undefined : state;
    }
    if (!stopped) timer = setTimeout(check, options.intervalMs ?? 500);
  };
  const started = check();
  return {
    started,
    close: () => {
      stopped = true;
      clearTimeout(timer);
      child?.kill();
    },
  };
};
