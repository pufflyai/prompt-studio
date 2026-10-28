import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import type { FrameManifest } from "../src/frames/module-graph";
import type { NativeBuildOutput } from "./native-build-output";

export interface FrameArchiveInputs {
  repoRoot: string;
  sources: Record<string, string>;
  projects: Record<string, string>;
  nativeSource: string;
  catalogSource: string;
}
const bindSources = (manifest: FrameManifest, sources: Map<string, string>, inputs: FrameArchiveInputs) => {
  const chunkFor = (source: string) => {
    const chunk = sources.get(resolve(inputs.repoRoot, source));
    if (!chunk) throw new Error(`Preview source has no emitted module: ${source}`);
    return chunk;
  };
  for (const [source, suite] of Object.entries(inputs.sources)) {
    const project = inputs.projects[suite];
    manifest.sources[source] = {
      script: chunkFor(source),
      ...(!source.endsWith(".mdx") && project ? { project: chunkFor(project) } : {}),
    };
  }
  manifest.sources.$native = { script: chunkFor(inputs.nativeSource) };
  manifest.catalog = chunkFor(inputs.catalogSource);
};
const chunkStyles = (output: NativeBuildOutput) => {
  if (output.type !== "chunk" || !output.viteMetadata?.importedCss.size) return {};
  return { css: [...output.viteMetadata.importedCss] };
};
const verifyStyleOwners = (manifest: FrameManifest) => {
  const owned = new Set(Object.values(manifest.modules).flatMap((module) => module.css ?? []));
  const missing = manifest.styles.filter((name) => !owned.has(name));
  if (missing.length) throw new Error(`Compiled styles have no dependency owner: ${missing.join(", ")}`);
};
export const publishFrameArchive = async (root: string, outputs: NativeBuildOutput[], inputs: FrameArchiveInputs) => {
  const directory = resolve(root, "frame-modules");
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const entry = outputs.find((file) => file.type === "chunk" && file.isEntry)!;
  const manifest: FrameManifest = { entry: entry.fileName, catalog: "", sources: {}, modules: {}, styles: [] };
  const sources = new Map<string, string>();
  for (const output of outputs) {
    if (output.type !== "chunk" && !output.fileName.endsWith(".css")) continue;
    const code =
      output.type === "chunk"
        ? output.code.replace(
            /(["'])\.\/([^"']+\.js)\1/g,
            (_match, quote, file) => `${quote}canvas-preview:${file}${quote}`,
          )
        : String(output.source);
    const name = `${createHash("sha256").update(code).digest("hex")}.txt`;
    await writeFile(resolve(directory, name), gzipSync(code).toString("base64"));
    manifest.modules[output.fileName] = {
      file: `src/catalog/generated/frame-modules/${name}`,
      imports: output.type === "chunk" ? (output.imports ?? []) : [],
      dynamicImports: output.type === "chunk" ? (output.dynamicImports ?? []) : [],
      bytes: Buffer.byteLength(code),
      ...chunkStyles(output),
    };
    if (output.type === "chunk")
      for (const source of Object.keys(output.modules ?? {})) sources.set(source.split("?")[0], output.fileName);
    else manifest.styles.push(output.fileName);
  }
  bindSources(manifest, sources, inputs);
  verifyStyleOwners(manifest);
  await writeFile(resolve(root, "frame-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(resolve(root, "frame-bundle.ts"), { force: true });
};
