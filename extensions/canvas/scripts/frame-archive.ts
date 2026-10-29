import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import type { FrameGraph } from "../src/frames/selection";
import type { NativeBuildOutput } from "./native-build-output";

export interface FrameArchiveInputs {
  repoRoot: string;
  sources: Record<string, string>;
  projects: Record<string, string>;
  nativeSources: Record<string, string>;
  catalogSource: string;
}
export const publishFrameArchive = async (root: string, outputs: NativeBuildOutput[], inputs: FrameArchiveInputs) => {
  const scripts: Record<string, string> = {};
  const styles: string[] = [];
  const styleNames = outputs
    .filter((output) => output.type === "asset" && output.fileName.endsWith(".css"))
    .map((output) => output.fileName);
  const chunks = outputs.filter((output) => output.type === "chunk");
  const chunkFor = (source: string) => {
    const chunk = chunks.find((chunk) => Object.hasOwn(chunk.modules ?? {}, source));
    if (!chunk) throw new Error(`Missing compiled preview source: ${source}`);
    return chunk.fileName;
  };
  const graph: FrameGraph = {
    entry: chunks.find((chunk) => chunk.isEntry)!.fileName,
    catalog: chunkFor(inputs.catalogSource),
    sources: Object.fromEntries(
      Object.entries(inputs.sources).map(([source, suite]) => [
        source,
        {
          script: chunkFor(resolve(inputs.repoRoot, source)),
          ...(!source.endsWith(".mdx") ? { project: chunkFor(inputs.projects[suite]!) } : {}),
        },
      ]),
    ),
    modules: Object.fromEntries(
      chunks.map((chunk) => [
        chunk.fileName,
        {
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          styles: [...(chunk.viteMetadata?.importedCss ?? [])].map((name) => {
            const index = styleNames.indexOf(name);
            if (index < 0) throw new Error(`Missing compiled stylesheet: ${name}`);
            return index;
          }),
        },
      ]),
    ),
  };
  for (const [name, source] of Object.entries(inputs.nativeSources))
    graph.sources[`$native:${name}`] = { script: chunkFor(source) };
  const ownedStyles = new Set(Object.values(graph.modules).flatMap((module) => module.styles));
  if (styleNames.some((_name, index) => !ownedStyles.has(index)))
    throw new Error("Preview styles must have an owning module");
  for (const output of outputs) {
    if (output.type === "chunk")
      scripts[output.fileName] = output.code.replace(
        /(["'])\.\/([^"']+\.js)\1/g,
        (_match, quote, file) => `${quote}canvas-preview:${file}${quote}`,
      );
    else if (output.fileName.endsWith(".css")) styles.push(String(output.source));
  }
  const entry = outputs.find((file) => file.type === "chunk" && file.isEntry)!.fileName;
  const encode = (source: string) => gzipSync(source).toString("base64");
  const payload = {
    scripts: Object.fromEntries(Object.entries(scripts).map(([name, source]) => [name, encode(source)])),
    styles: styles.map(encode),
    entry: `canvas-preview:${entry}`,
    graph,
  };
  await writeFile(
    resolve(root, "frame-bundle.ts"),
    `// Generated source-component preview modules.\nexport default ${JSON.stringify(payload)} as import("../../frames/assets").FrameArchive;\n`,
  );
};
