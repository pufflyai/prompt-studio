import { resolve } from "node:path";
import { type CanvasBuildOptions, isCurrent, readManifest, resolveOut } from "./build";

const CLI = resolve(import.meta.dir, "../../bin/pstdio-canvas.ts");

export interface CanvasWatchOptions extends Omit<CanvasBuildOptions, "force"> {
  /** How often to check the last build's files for changes. */
  intervalMs?: number;
  /** Called after each build with the build's exit code. */
  onBuild?: (exitCode: number) => void;
}

/**
 * Rebuilds the canvases whenever a canvas file or a file the last build read changes.
 *
 * It checks the last build's own inputs instead of registering a recursive `fs.watch`: on Linux
 * that walks every folder, including `node_modules` symlinks (lesson 0012). Each build runs in a
 * new Bun process, because a long-running process keeps package resolutions it has already read
 * and would miss newly installed packages.
 */
export const watchCanvases = (options: CanvasWatchOptions) => {
  const root = resolve(options.root);
  const out = resolveOut(root, options.out);
  let stopped = false;
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
  };
  const check = async () => {
    const manifest = await readManifest(out);
    if (!stopped && !(manifest && (await isCurrent(root, manifest)))) await build();
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
