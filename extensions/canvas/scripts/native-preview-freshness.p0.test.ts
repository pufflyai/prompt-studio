import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { previews } from "../src/canvases/previews";
import frames from "../src/catalog/generated/frame-manifest.json";
import catalog from "../src/catalog/generated/stories.json";
import { selectFrameModules } from "../src/frames/module-graph";
import { checkNativeBuildFreshness } from "./native-build-freshness";
import { extensionRoot } from "./story-catalog";

test("native previews match the component sources, fixtures, and generated files", async () => {
  const { manifest, stale } = await checkNativeBuildFreshness();
  expect(stale).toEqual([]);
  expect(Object.keys(manifest.hashes).length).toBeGreaterThan(340);
  expect(Object.keys(manifest.outputs)).not.toHaveLength(0);
});

test("every catalog source has a complete packaged dependency graph", () => {
  const sources = [...new Set(catalog.stories.map((entry) => entry.source))];
  const native = Object.keys(previews).map((name) => `$native:${name}`);
  expect(Object.keys(frames.sources).sort()).toEqual([...sources, ...native].sort());
  const assets = new Set(frames.styles);
  for (const source of [...sources, ...native, "$runtime"]) {
    const modules = selectFrameModules(frames, source);
    expect(modules).toContain(frames.entry);
    for (const name of modules) assets.add(name);
  }
  for (const name of assets)
    expect(existsSync(resolve(extensionRoot, frames.modules[name as keyof typeof frames.modules].file))).toBe(true);
});

test("example graphs include the provider used by their catalog suite, including fallback suites", () => {
  const providers = new Map<string, string>();
  for (const { source, suite } of catalog.stories) {
    const frame = frames.sources[source as keyof typeof frames.sources];
    const provider = "project" in frame ? frame.project : undefined;
    if (provider) providers.set(suite, provider);
  }
  for (const { source, suite } of catalog.stories) {
    const frame = frames.sources[source as keyof typeof frames.sources];
    expect("project" in frame ? frame.project : undefined, source).toBe(providers.get(suite));
  }
});
