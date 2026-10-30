import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import type { CanvasEntry, FrameManifest } from "./manifest";

type Metafile = NonNullable<Bun.BuildOutput["metafile"]>;
const toPosix = (path: string) => path.split(sep).join("/");
const outputName = (path: string) => path.replace(/^\.\//, "");
const FRAME_ENTRY = `${sep}entries${sep}frame.tsx`;

// Frames import modules by bare names that the frame maps to blob URLs, so relative chunk
// references become `canvas-preview:<name>`.
const rewriteImports = (code: string, names: Set<string>) =>
  code.replace(/(["'`])\.\/([^"'`]+\.js)\1/g, (match, quote, file) =>
    names.has(file) ? `${quote}canvas-preview:${file}${quote}` : match,
  );

const encode = (code: string) => {
  const bytes = gzipSync(code);
  // The gzip OS byte describes the machine, not the content. Keep names stable across machines.
  bytes[9] = 255;
  return bytes.toString("base64");
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
  const frames: FrameManifest = { entry: "", catalog: "", sources: {}, modules: {}, styles: [] };
  const chunkFor = new Map<string, string>();
  await mkdir(join(out, "modules"), { recursive: true });
  for (const [path, output] of outputs) {
    const name = outputName(path);
    const raw = await readFile(join(staging, name), "utf8");
    const code = name.endsWith(".js") ? rewriteImports(raw, names) : raw;
    const file = `modules/${createHash("sha256").update(code).digest("hex")}.txt`;
    await writeFile(join(out, file), encode(code));
    if (name.endsWith(".css")) {
      frames.styles.push(name);
      frames.modules[name] = { file, imports: [], dynamicImports: [], bytes: Buffer.byteLength(code) };
      continue;
    }
    const linked = (kind: string) =>
      output.imports.filter((entry) => entry.kind === kind).map((entry) => outputName(entry.path));
    // The frame entry's CSS bundle collects every canvas's styles; the runtime itself has none.
    const isFrameEntry = output.entryPoint?.endsWith(FRAME_ENTRY);
    frames.modules[name] = {
      file,
      imports: linked("import-statement"),
      dynamicImports: linked("dynamic-import"),
      bytes: Buffer.byteLength(code),
      ...(output.cssBundle && !isFrameEntry ? { css: [outputName(output.cssBundle)] } : {}),
    };
    if (output.entryPoint) chunkFor.set(resolve(output.entryPoint), name);
  }
  const entry = [...chunkFor].find(([source]) => source.endsWith(FRAME_ENTRY))?.[1];
  if (!entry) throw new Error("The canvas build produced no frame entry");
  // The entry holds the map of canvas loaders; frames follow only the dynamic imports they need.
  frames.entry = entry;
  frames.catalog = entry;
  for (const canvas of canvases) {
    if (canvas.error) continue;
    const script = chunkFor.get(join(root, canvas.id));
    if (!script) throw new Error(`The canvas build produced no module for ${canvas.id}`);
    const project = canvas.preview ? chunkFor.get(join(root, canvas.preview)) : undefined;
    frames.sources[canvas.id] = { script, ...(project ? { project } : {}) };
  }
  return frames;
};

/** Modification times of the project files a build read. Installed packages are left out. */
export const readInputs = async (
  root: string,
  workdir: string,
  metafile: Metafile,
  canvases: CanvasEntry[],
  failedFiles: Set<string>,
) => {
  const files = new Set([
    ...failedFiles,
    ...Object.keys(metafile.inputs).map((path) => resolve(path)),
    ...canvases.flatMap((canvas) => [join(root, canvas.id), ...(canvas.preview ? [join(root, canvas.preview)] : [])]),
  ]);
  const inputs: Record<string, number> = {};
  for (const file of [...files].sort()) {
    const path = toPosix(relative(root, file));
    if (path.startsWith("..") || path.split("/").includes("node_modules") || file.startsWith(workdir)) continue;
    const info = await stat(file).catch(() => undefined);
    if (info) inputs[path] = info.mtimeMs;
  }
  return inputs;
};
