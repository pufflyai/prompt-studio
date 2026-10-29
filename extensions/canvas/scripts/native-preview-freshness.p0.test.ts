import { expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import archive from "../src/catalog/generated/frame-bundle";
import catalog from "../src/catalog/generated/stories.json";
import type { FrameBootstrap } from "../src/frames/assets";
import { selectFrameBootstrap } from "../src/frames/selection";
import { checkNativeBuildFreshness } from "./native-build-freshness";

test("native previews match the component sources, fixtures, and generated files", async () => {
  const { manifest, stale } = await checkNativeBuildFreshness();
  expect(stale).toEqual([]);
  expect(Object.keys(manifest.hashes).length).toBeGreaterThan(340);
  expect(Object.keys(manifest.outputs)).not.toHaveLength(0);
});

test("every retained preview has a complete startup graph and its suite provider", () => {
  const data = JSON.parse(gunzipSync(Buffer.from(archive, "base64")).toString()) as {
    scripts: Record<string, string>;
    styles: string[];
    entry: string;
    graph: FrameBootstrap["graph"];
  };
  const all: FrameBootstrap = {
    entry: `canvas-preview:${data.entry}`,
    graph: data.graph,
    scripts: Object.fromEntries(Object.entries(data.scripts).map(([name, code]) => [name, new Blob([code])])),
    styles: data.styles.map((style) => new Blob([style])),
  };
  const sources = [...new Set([...catalog.stories, ...catalog.documents].map((entry) => entry.source)), "$native"];
  expect(Object.keys(all.graph.sources).sort()).toEqual(sources.sort());
  for (const source of sources) {
    const selected = selectFrameBootstrap(all, source);
    const description = all.graph.sources[source]!;
    expect(selected.scripts[description.script]).toBe(all.scripts[description.script]);
    if (description.project) expect(selected.scripts[description.project]).toBe(all.scripts[description.project]);
    expect(selected.styles.length).toBeGreaterThan(0);
  }
  expect(Object.keys(selectFrameBootstrap(all, "$native").scripts).length).toBeLessThan(
    Object.keys(all.scripts).length,
  );
});
