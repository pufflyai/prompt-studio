import { createHash } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type FrameArchiveInputs, publishFrameArchive } from "./frame-archive";
import { generatedRoot, repoRoot } from "./story-catalog";
import { catalogMetadata, parserInputs } from "./story-catalog-cache";

interface Chunk {
  type: "chunk";
  fileName: string;
  code: string;
  isEntry?: boolean;
  modules?: Record<string, unknown>;
  imports?: string[];
  dynamicImports?: string[];
}
interface Asset {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
}
export type NativeBuildOutput = Chunk | Asset;
export const publishNativeBuild = async (
  outputs: NativeBuildOutput[],
  counts: { stories: number; documents: number },
  inputs: FrameArchiveInputs,
) => {
  await rm(resolve(generatedRoot, "native"), { recursive: true, force: true });
  await rm(resolve(generatedRoot, "native-preview.ts"), { force: true });
  await publishFrameArchive(generatedRoot, outputs, inputs);
  const outputHashes: Record<string, string> = {};
  for (const file of [
    "frame-manifest.json",
    ...(await readdir(resolve(generatedRoot, "frame-modules"))).map((name) => `frame-modules/${name}`),
  ])
    outputHashes[file] = createHash("sha256")
      .update(await readFile(resolve(generatedRoot, file)))
      .digest("hex");
  const sources = [
    ...new Set(outputs.filter((file) => file.type === "chunk").flatMap((file) => Object.keys(file.modules ?? {}))),
  ];
  const hashes: Record<string, string> = {};
  for (const source of [
    "extensions/canvas/package.json",
    "extensions/canvas/scripts/build-catalog.ts",
    "extensions/canvas/scripts/build-native-previews.ts",
    "extensions/canvas/scripts/native-build-output.ts",
    "extensions/canvas/scripts/frame-archive.ts",
    ...["frame-runtime.tsx", "frame-navigation.ts", "frame-story.tsx"].map(
      (file) => `extensions/canvas/scripts/${file}`,
    ),
    ...parserInputs,
    ...catalogMetadata,
    "packages/sdk/package.json",
    "packages/pstdio-workbench/build-entries.ts",
  ]) {
    hashes[source] = createHash("sha256")
      .update(await readFile(resolve(repoRoot, source)))
      .digest("hex");
  }
  for (const path of sources) {
    if (!path.startsWith(`${repoRoot}/`) || path.includes("/node_modules/") || path.includes("/__test-tmp__/"))
      continue;
    if (path.includes("/catalog/generated/native") || path.endsWith("/catalog/generated/frame-bundle.ts")) continue;
    if (!(await Bun.file(path).exists())) continue;
    hashes[path.slice(repoRoot.length + 1)] = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  }
  for (const path of [
    "extensions/canvas/scripts/native-api-fixture.ts",
    "packages/ui/.canvas/document-blocks.tsx",
    "packages/canvas/src/native-preview-runtime.tsx",
  ]) {
    hashes[path] = createHash("sha256")
      .update(await readFile(resolve(repoRoot, path)))
      .digest("hex");
  }
  await writeFile(
    resolve(generatedRoot, "native-manifest.json"),
    `${JSON.stringify(
      {
        hashes,
        outputs: outputHashes,
        stories: counts.stories,
        documents: counts.documents,
        bytes: outputs.reduce(
          (sum, file) => sum + (file.type === "chunk" ? Buffer.byteLength(file.code) : Buffer.byteLength(file.source)),
          0,
        ),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${counts.stories} native stories and ${counts.documents} native documents`);
};
