import { relative } from "node:path";
import { buildCanvases, resolveOut, resolveRoot } from "./build";
import { discoverCanvases } from "./discover";
import type { CanvasBuildManifest } from "./manifest";
import { watchCanvases } from "./watch";

const USAGE = `Usage: pstdio-canvas <command> [--root <dir>] [--out <dir>]

Commands:
  watch   Build the project's canvases, then rebuild whenever their files change.
  build   Build the project's canvases once. Add --force to build even when nothing changed.
  list    Print the project's canvases as JSON.

--root defaults to the current folder. --out defaults to .pstdio/extension-storage/pstdio.canvas/build,
the folder UI Canvas reads.`;

const option = (args: string[], name: string) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? undefined : args[index + 1];
};

const report = (manifest: CanvasBuildManifest, built: boolean, out: string) => {
  const failed = manifest.canvases.filter((canvas) => canvas.error);
  for (const canvas of failed) console.error(`✗ ${canvas.id}\n${canvas.error}\n`);
  const summary = `${manifest.canvases.length} canvases, ${failed.length} failed`;
  console.log(built ? `Built ${summary} into ${out}.` : `Canvases are current (${summary}).`);
};

/** Runs the `pstdio-canvas` command and returns its exit code. */
export const runCli = async (args: string[]) => {
  const [command] = args;
  const root = resolveRoot(option(args, "root") ?? process.cwd());
  const out = option(args, "out");
  switch (command) {
    case "list":
      console.log(JSON.stringify(await discoverCanvases(root), null, 2));
      return 0;
    case "build": {
      // Failed canvases are reported in the manifest; the build itself still succeeded.
      const { built, manifest } = await buildCanvases({ root, out, force: args.includes("--force") });
      report(manifest, built, relative(root, resolveOut(root, out)) || ".");
      return 0;
    }
    case "watch": {
      const watcher = watchCanvases({ root, out });
      console.log(`Watching ${root} for canvas changes. Press Ctrl+C to stop.`);
      await new Promise((done) => {
        process.once("SIGINT", done);
        process.once("SIGTERM", done);
      });
      await watcher.close();
      return 0;
    }
    default:
      console.log(USAGE);
      return command && command !== "--help" ? 1 : 0;
  }
};
