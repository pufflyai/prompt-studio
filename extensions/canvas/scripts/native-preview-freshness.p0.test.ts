import { expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { previews } from "../src/canvases/previews";
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
  const decode = (data: string) => new Blob([gunzipSync(Buffer.from(data, "base64"))]);
  const all: FrameBootstrap = {
    entry: archive.entry,
    graph: archive.graph,
    scripts: Object.fromEntries(Object.entries(archive.scripts).map(([name, code]) => [name, decode(code)])),
    styles: archive.styles.map(decode),
  };
  const sources = [
    ...new Set([...catalog.stories, ...catalog.documents].map((entry) => entry.source)),
    ...Object.keys(previews).map((name) => `$native:${name}`),
  ];
  expect(Object.keys(all.graph.sources).sort()).toEqual(sources.sort());
  for (const source of sources) {
    const selected = selectFrameBootstrap(all, source);
    const description = all.graph.sources[source]!;
    expect(selected.scripts[description.script]).toBe(all.scripts[description.script]);
    if (description.project) expect(selected.scripts[description.project]).toBe(all.scripts[description.project]);
    expect(selected.styles.length).toBeGreaterThan(0);
  }
  expect(Object.keys(selectFrameBootstrap(all, "$native:project-form").scripts).length).toBeLessThan(
    Object.keys(all.scripts).length,
  );
});
