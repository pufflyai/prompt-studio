import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { ASSET_TYPES } from "./bundle";
import type { CanvasEntry, FrameManifest } from "./manifest";

type Metafile = NonNullable<Bun.BuildOutput["metafile"]>;
const toPosix = (path: string) => path.split(sep).join("/");
const outputName = (path: string) => path.replace(/^\.\//, "");
// Bun writes metafile paths with forward slashes, relative to the project root it built from.
const fromMetafile = (root: string, path: string) => toPosix(resolve(root, path));
const isFrameEntry = (root: string, path?: string) =>
  Boolean(path && fromMetafile(root, path).endsWith("/entries/frame.tsx"));

/** The absolute paths of every file the build read. */
export const metafileInputs = (root: string, metafile: Metafile) =>
  Object.keys(metafile.inputs).map((path) => resolve(root, path));

// Module files are named by content, so an existing file already holds these bytes. A new one
// appears whole, because readers may load modules while a build runs.
const writeModule = async (path: string, code: string) => {
  if (existsSync(path)) return;
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, encode(code));
  await rename(temporary, path);
};

// Frames import modules by bare names that the frame maps to blob URLs, so relative chunk
// references become `canvas-preview:<name>`.
const rewriteImports = (code: string, names: Set<string>) =>
  code.replace(/(["'`])\.\/([^"'`]+\.js)\1/g, (match, quote, file) =>
    names.has(file) ? `${quote}canvas-preview:${file}${quote}` : match,
  );

// Emitted images, fonts and media, as data URLs keyed by their output name.
const readAssets = async (staging: string) => {
  const assets = new Map<string, string>();
  for (const name of await readdir(staging)) {
    const type = ASSET_TYPES[name.split(".").at(-1)!.toLowerCase()];
    if (type) assets.set(name, `data:${type};base64,${(await readFile(join(staging, name))).toString("base64")}`);
  }
  return assets;
};

// JavaScript refers to an emitted asset as "./name" and CSS as url(./name) or url("./name").
const inlineAssets = (code: string, assets: Map<string, string>) =>
  code.replace(/(["'(])\.\/([^"'()\s]+)/g, (match, before, name) => {
    const url = assets.get(name);
    return url ? `${before}${url}` : match;
  });

const encode = (code: string) => {
  const bytes = gzipSync(code);
  // The gzip OS byte describes the machine, not the content. Keep names stable across machines.
  bytes[9] = 255;
  return bytes.toString("base64");
};

type Output = Metafile["outputs"][string];

const moduleEntry = (root: string, output: Output, file: string, bytes: number) => {
  const linked = (kind: string) =>
    output.imports.filter((entry) => entry.kind === kind).map((entry) => outputName(entry.path));
  // The frame entry's CSS bundle collects every canvas's styles; the runtime itself has none.
  const css = output.cssBundle && !isFrameEntry(root, output.entryPoint) ? [outputName(output.cssBundle)] : undefined;
  return {
    file,
    imports: linked("import-statement"),
    dynamicImports: linked("dynamic-import"),
    bytes,
    ...(css ? { css } : {}),
  };
};

const bindSources = (root: string, frames: FrameManifest, chunkFor: Map<string, string>, canvases: CanvasEntry[]) => {
  for (const canvas of canvases) {
    if (canvas.error) continue;
    const script = chunkFor.get(toPosix(join(root, canvas.id)));
    if (!script) throw new Error(`The canvas build produced no module for ${canvas.id}`);
    const project = canvas.preview ? chunkFor.get(toPosix(join(root, canvas.preview))) : undefined;
    frames.sources[canvas.id] = { script, ...(project ? { project } : {}) };
  }
};

/**
 * Turns Bun's split output into the module graph frames load. Module files are named by their
 * content, so a rebuild only writes the modules that changed.
 */
export const archiveBuild = async (input: {
  root: string;
  out: string;
  staging: string;
  metafile: Metafile;
  canvases: CanvasEntry[];
}) => {
  const { root, out, staging, metafile, canvases } = input;
  const outputs = Object.entries(metafile.outputs);
  const names = new Set(outputs.map(([path]) => outputName(path)));
  const assets = await readAssets(staging);
  const frames: FrameManifest = { entry: "", catalog: "", sources: {}, modules: {}, styles: [] };
  const chunkFor = new Map<string, string>();
  await mkdir(join(out, "modules"), { recursive: true });
  for (const [path, output] of outputs) {
    const name = outputName(path);
    const raw = inlineAssets(await readFile(join(staging, name), "utf8"), assets);
    const code = name.endsWith(".js") ? rewriteImports(raw, names) : raw;
    const file = `modules/${createHash("sha256").update(code).digest("hex")}.txt`;
    await writeModule(join(out, file), code);
    const bytes = Buffer.byteLength(code);
    if (name.endsWith(".css")) {
      frames.styles.push(name);
      frames.modules[name] = { file, imports: [], dynamicImports: [], bytes };
      continue;
    }
    frames.modules[name] = moduleEntry(root, output, file, bytes);
    if (isFrameEntry(root, output.entryPoint)) frames.entry = name;
    else if (output.entryPoint) chunkFor.set(fromMetafile(root, output.entryPoint), name);
  }
  if (!frames.entry) throw new Error("The canvas build produced no frame entry");
  // The entry holds the map of canvas loaders; frames follow only the dynamic imports they need.
  frames.catalog = frames.entry;
  bindSources(root, frames, chunkFor, canvases);
  return frames;
};
