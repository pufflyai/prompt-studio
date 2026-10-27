import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generatedRoot, repoRoot } from "./story-catalog";
import { catalogMetadata, parserInputs } from "./story-catalog-cache";

interface Chunk {
  type: "chunk";
  fileName: string;
  code: string;
  isEntry?: boolean;
  modules?: Record<string, unknown>;
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
) => {
  const outputRoot = resolve(generatedRoot, "native");
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const outputHashes: Record<string, string> = {};
  for (const file of outputs) {
    const target = file.fileName.replace(/\.js$/, ".ts");
    const code =
      file.type === "chunk"
        ? "// @ts-nocheck\n// Generated from source components; regenerate with build-native-previews.ts.\n" +
          file.code.replace(/(\.\/[^"']+)\.js(["'])/g, "$1.ts$2")
        : file.source;
    await writeFile(resolve(outputRoot, target), code);
    outputHashes[target] = createHash("sha256").update(code).digest("hex");
  }
  const entryFile = outputs.find((file) => file.type === "chunk" && file.isEntry)!.fileName.replace(/\.js$/, ".ts");
  const styles = outputs.filter((file) => file.type === "asset" && file.fileName.endsWith(".css"));
  await writeFile(
    resolve(generatedRoot, "native-preview.ts"),
    styles.map((file) => `import "./native/${file.fileName}";`).join("\n") +
      '\nexport {loadPreview} from "./native/' +
      entryFile +
      '";\n',
  );
  const sources = [
    ...new Set(outputs.filter((file) => file.type === "chunk").flatMap((file) => Object.keys(file.modules ?? {}))),
  ];
  const hashes: Record<string, string> = {};
  for (const source of [
    ".pstdio/extensions/canvas/package.json",
    ".pstdio/extensions/canvas/scripts/build-native-previews.ts",
    ".pstdio/extensions/canvas/scripts/native-build-output.ts",
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
    if (path.includes("/catalog/generated/native")) continue;
    if (!(await Bun.file(path).exists())) continue;
    hashes[path.slice(repoRoot.length + 1)] = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  }
  for (const file of ["native-api-fixture.ts", "native-document-blocks.tsx", "native-preview-runtime.tsx"]) {
    const path = `.pstdio/extensions/canvas/scripts/${file}`;
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
