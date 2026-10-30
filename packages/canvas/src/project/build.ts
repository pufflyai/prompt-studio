import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { archiveBuild, metafileInputs } from "./archive";
import { bundleCanvases } from "./bundle";
import { createPreviewFinder, discoverCanvases, listCanvasFiles } from "./discover";
import { collectInputs, inputsUnchanged, readInputs } from "./inputs";
import { lockOutput } from "./lock";
import { type CanvasBuildManifest, DEFAULT_OUT, MANIFEST_FORMAT } from "./manifest";

export interface CanvasBuildOptions {
  /** The project root. */
  root: string;
  /** The output folder, relative to the root or absolute. */
  out?: string;
  /** Build even when no input changed. */
  force?: boolean;
}

/** Bun reports real paths, so a root reached through a symbolic link is resolved first. */
export const resolveRoot = (root: string) => realpathSync(resolve(root));
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
 * True when the canvas files, their preview files and every input of the last build are unchanged.
 * Cheap enough to poll: it lists files and reads modification times, but parses nothing.
 */
export const isCurrent = async (root: string, manifest: CanvasBuildManifest) => {
  const findPreview = createPreviewFinder(root);
  const files = await listCanvasFiles(root);
  const built = manifest.canvases;
  if (files.length !== built.length) return false;
  for (const [index, file] of files.entries())
    if (built[index]?.id !== file || built[index]?.preview !== findPreview(file)) return false;
  return inputsUnchanged(root, manifest.inputs);
};

// Readers may still load modules of the manifest they read last, so keep that generation too.
const removeUnusedModules = async (out: string, manifests: (CanvasBuildManifest | undefined)[]) => {
  const used = new Set(
    manifests.flatMap((manifest) => Object.values(manifest?.frames.modules ?? {}).map((module) => module.file)),
  );
  for (const name of await readdir(join(out, "modules")))
    if (!used.has(`modules/${name}`)) await rm(join(out, "modules", name), { force: true });
};

// A build that was killed leaves its work folder behind.
const removeWorkFolders = async (out: string) => {
  for (const name of await readdir(out))
    if (name.startsWith(".work-")) await rm(join(out, name), { recursive: true, force: true });
};

const writeManifest = async (out: string, manifest: CanvasBuildManifest) => {
  // Readers see the old manifest or the new one, never a partly written file.
  const temporary = join(out, `manifest.${randomUUID()}.json`);
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporary, join(out, "manifest.json"));
};

const build = async (root: string, out: string, previous: CanvasBuildManifest | undefined) => {
  // Files saved from now on may be read before or after the change; they are recorded as unknown.
  // The pause puts every earlier write before the cutoff.
  const startedAt = Date.now() + 1;
  await Bun.sleep(2);
  const discovered = await discoverCanvases(root);
  const workdir = join(out, `.work-${randomUUID()}`);
  try {
    const { result, errors, failedFiles } = await bundleCanvases(root, workdir, join(workdir, "dist"), discovered);
    const metafile = result.metafile!;
    const canvases = discovered.map((canvas) =>
      errors.has(canvas.id) ? { ...canvas, error: errors.get(canvas.id) } : canvas,
    );
    const read = metafileInputs(root, metafile).filter((file) => !file.startsWith(workdir));
    const manifest: CanvasBuildManifest = {
      format: MANIFEST_FORMAT,
      builtAt: new Date().toISOString(),
      canvases,
      frames: await archiveBuild({ root, out, staging: join(workdir, "dist"), metafile, canvases }),
      inputs: await readInputs(root, collectInputs(root, read, canvases, failedFiles), startedAt),
    };
    await writeManifest(out, manifest);
    await removeUnusedModules(out, [manifest, previous]);
    return manifest;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
};

export const buildCanvases = async (options: CanvasBuildOptions) => {
  const root = resolveRoot(options.root);
  const out = resolveOut(root, options.out);
  await mkdir(out, { recursive: true });
  await writeFile(join(out, ".gitignore"), "*\n");
  const lock = await lockOutput(out);
  try {
    await removeWorkFolders(out);
    const previous = await readManifest(out);
    if (!options.force && previous && (await isCurrent(root, previous))) return { built: false, manifest: previous };
    return { built: true, manifest: await build(root, out, previous) };
  } finally {
    await lock.release();
  }
};
