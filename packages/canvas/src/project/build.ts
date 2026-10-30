import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { archiveBuild, readInputs } from "./archive";
import { bundleCanvases } from "./bundle";
import { createPreviewFinder, discoverCanvases, listCanvasFiles } from "./discover";
import { type CanvasBuildManifest, DEFAULT_OUT, MANIFEST_FORMAT } from "./manifest";

export interface CanvasBuildOptions {
  /** The project root. */
  root: string;
  /** The output folder, relative to the root or absolute. */
  out?: string;
  /** Build even when no input changed. */
  force?: boolean;
}

export const resolveOut = (root: string, out = DEFAULT_OUT) => resolve(root, out);

export const readManifest = async (out: string) => {
  try {
    const manifest = JSON.parse(await readFile(join(out, "manifest.json"), "utf8")) as CanvasBuildManifest;
    return manifest.format === MANIFEST_FORMAT ? manifest : undefined;
  } catch {
    return undefined;
  }
};

/**
 * True when the canvas files, their preview files and every file the last build read are unchanged.
 * Cheap enough to poll: it lists files and reads modification times, but parses nothing.
 */
export const isCurrent = async (root: string, manifest: CanvasBuildManifest) => {
  const findPreview = createPreviewFinder(root);
  const files = await listCanvasFiles(root);
  const built = manifest.canvases;
  if (files.length !== built.length) return false;
  for (const [index, file] of files.entries())
    if (built[index]?.id !== file || built[index]?.preview !== findPreview(file)) return false;
  for (const [path, modified] of Object.entries(manifest.inputs)) {
    const info = await stat(join(root, path)).catch(() => undefined);
    if (info?.mtimeMs !== modified) return false;
  }
  return true;
};

// Readers may still load modules of the manifest they read last, so keep that generation too.
const removeUnusedModules = async (out: string, manifests: (CanvasBuildManifest | undefined)[]) => {
  const used = new Set(
    manifests.flatMap((manifest) => Object.values(manifest?.frames.modules ?? {}).map((module) => module.file)),
  );
  for (const name of await readdir(join(out, "modules")))
    if (!used.has(`modules/${name}`)) await rm(join(out, "modules", name), { force: true });
};

export const buildCanvases = async (options: CanvasBuildOptions) => {
  const root = resolve(options.root);
  const out = resolveOut(root, options.out);
  await mkdir(out, { recursive: true });
  await writeFile(join(out, ".gitignore"), "*\n");
  const previous = await readManifest(out);
  if (!options.force && previous && (await isCurrent(root, previous))) return { built: false, manifest: previous };

  const discovered = await discoverCanvases(root);
  const workdir = join(out, `.work-${randomUUID()}`);
  const staging = join(workdir, "dist");
  try {
    const { result, errors, failedFiles } = await bundleCanvases(root, workdir, staging, discovered);
    const metafile = result.metafile!;
    const canvases = discovered.map((canvas) =>
      errors.has(canvas.id) ? { ...canvas, error: errors.get(canvas.id) } : canvas,
    );
    const manifest: CanvasBuildManifest = {
      format: MANIFEST_FORMAT,
      builtAt: new Date().toISOString(),
      canvases,
      frames: await archiveBuild({ root, out, staging, metafile, canvases }),
      inputs: await readInputs(root, workdir, metafile, canvases, failedFiles),
    };
    // Readers see the old manifest or the new one, never a partly written file.
    const temporary = join(out, `manifest.${randomUUID()}.json`);
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
    await rename(temporary, join(out, "manifest.json"));
    await removeUnusedModules(out, [manifest, previous]);
    return { built: true, manifest };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
};
