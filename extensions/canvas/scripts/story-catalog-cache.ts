import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CatalogStory } from "./story-catalog";
import type { ParsedStorySource } from "./story-parser-worker";

const scriptRoot = "extensions/canvas/scripts";
const metadataRoot = "extensions/canvas/src/catalog/generated";
export const parserInputs = [
  "bun.lock",
  "packages/ui/package.json",
  "packages/canvas/package.json",
  "packages/canvas/src/indexer.ts",
  ...["story-catalog.ts", "story-catalog-cache.ts", "parse-story-sources.ts", "story-parser-worker.ts"].map(
    (file) => `${scriptRoot}/${file}`,
  ),
];
export const catalogMetadata = [`${metadataRoot}/stories.json`, `${metadataRoot}/source-information.json`];
export const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

// Reuse canonical parser output only while its compiler, dependency lock and metadata bytes match.
// Callers still read and hash every current source; changed and new files use the real parser.
export const readStoryParserCache = async (root: string) => {
  const cache = new Map<string, { hash: string; parsed: ParsedStorySource }>();
  try {
    const manifest = await Bun.file(resolve(root, metadataRoot, "native-manifest.json")).json();
    const files = await Promise.all(
      [...parserInputs, ...catalogMetadata].map(async (path) => ({
        path,
        bytes: await readFile(resolve(root, path)),
      })),
    );
    if (files.some(({ path, bytes }) => manifest.hashes[path] !== digest(bytes))) return cache;
    const metadata = new Map(files.map(({ path, bytes }) => [path, bytes.toString()]));
    const { stories } = JSON.parse(metadata.get(catalogMetadata[0])!) as { stories: CatalogStory[] };
    const sources = JSON.parse(metadata.get(catalogMetadata[1])!) as Record<string, { hash: string }>;
    for (const story of stories) {
      let entry = cache.get(story.source);
      if (!entry) {
        entry = {
          hash: sources[story.source].hash,
          parsed: {
            source: story.source,
            title: story.title,
            component: story.component,
            componentImport: story.componentImport,
            stories: [],
          },
        };
        cache.set(story.source, entry);
      }
      entry.parsed.stories.push({
        id: story.id.slice(story.suite.length + 1),
        name: story.name,
        exportName: story.exportName,
      });
    }
  } catch {
    return new Map<string, { hash: string; parsed: ParsedStorySource }>();
  }
  return cache;
};
