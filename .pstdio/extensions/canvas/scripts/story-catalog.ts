import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseStorySources } from "./parse-story-sources";
import { readStoryParserCache } from "./story-catalog-cache";

export const repoRoot = resolve(import.meta.dir, "../../../..");
export const extensionRoot = resolve(repoRoot, ".pstdio/extensions/canvas");
export const generatedRoot = resolve(extensionRoot, "src/catalog/generated");
export const suites = {
  ui: "packages/ui",
  workbench: "packages/pstdio-workbench",
  dashboard: "packages/pstdio-dashboard",
  themes: "extensions/pstdio-base-themes",
  desktop: "clients/desktop",
  website: "clients/landing-page",
} as const;
export type Suite = keyof typeof suites;
export interface CatalogStory {
  id: string;
  name: string;
  exportName: string;
  source: string;
  suite: Suite;
  title: string;
  sourceHash: string;
  component?: string;
  componentImport?: string;
}
export const sourceFiles = async (root = repoRoot) => {
  // Git includes new source files without traversing every installed dependency and build output.
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "packages",
      "extensions",
      "clients",
      ".pstdio/extensions",
    ],
    { cwd: root, encoding: "utf8" },
  ).split("\0");
  return [...new Set(files)]
    .filter(
      (file) =>
        /\.(canvas\.tsx?|mdx)$/.test(file) &&
        !/(^|\/)(node_modules|dist|\.publish|__test-tmp__|canvas-test-static)\//.test(file) &&
        existsSync(resolve(root, file)),
    )
    .sort();
};
export const suiteForSource = (source: string): Suite => {
  const suite = Object.entries(suites).find(([, path]) => source.startsWith(`${path}/`));
  return (suite?.[0] as Suite | undefined) ?? "dashboard";
};
export const collectStoryCatalog = async () => {
  const stories: CatalogStory[] = [];
  const documents: { id: string; name: string; source: string; suite: Suite; content: string; sourceHash: string }[] =
    [];
  const sources: Record<string, { code: string; hash: string; component?: string; componentImport?: string }> = {};
  const files = await Promise.all(
    (await sourceFiles()).map(async (source) => {
      const text = await readFile(resolve(repoRoot, source), "utf8");
      return { source, text, hash: createHash("sha256").update(text).digest("hex") };
    }),
  );
  const cache = await readStoryParserCache(repoRoot);
  const parsed = await parseStorySources(
    files.filter((file) => !file.source.endsWith(".mdx") && cache.get(file.source)?.hash !== file.hash),
    resolve(repoRoot, "packages/ui/package.json"),
  );
  for (const { source, text, hash } of files) {
    sources[source] = { code: text, hash };
    if (source.endsWith(".mdx")) {
      documents.push({
        id: `docs-${createHash("sha256").update(source).digest("hex").slice(0, 12)}`,
        name: text.match(/<Meta[^>]*title="([^"]+)"/)?.[1] ?? text.match(/^#\s+(.+)$/m)?.[1] ?? source,
        source,
        content: text,
        suite: suiteForSource(source),
        sourceHash: hash,
      });
      continue;
    }
    const suite = suiteForSource(source);
    const csf = parsed.get(source) ?? cache.get(source)!.parsed;
    sources[source].component = csf.component;
    sources[source].componentImport = csf.componentImport;
    for (const story of csf.stories) {
      stories.push({
        id: `${suite}-${story.id}`,
        name: story.name,
        exportName: story.exportName,
        source,
        suite,
        title: csf.title,
        sourceHash: hash,
        component: csf.component,
        componentImport: csf.componentImport,
      });
    }
  }
  const ids = stories.map((story) => story.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate story ids in UI Canvas catalog");
  return { stories, documents, sources };
};

export const generateStoryCatalog = async () => {
  const catalog = await collectStoryCatalog();
  await mkdir(generatedRoot, { recursive: true });
  await writeFile(
    resolve(generatedRoot, "stories.json"),
    `${JSON.stringify({ stories: catalog.stories, documents: catalog.documents }, null, 2)}\n`,
  );
  await writeFile(resolve(generatedRoot, "source-information.json"), `${JSON.stringify(catalog.sources, null, 2)}\n`);
  console.log(`${catalog.stories.length} stories and ${catalog.documents.length} documents indexed`);
  return catalog;
};
if (import.meta.main) await generateStoryCatalog();
