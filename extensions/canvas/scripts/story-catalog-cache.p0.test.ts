import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { catalogMetadata, digest, parserInputs, readStoryParserCache } from "./story-catalog-cache";

test("parser reuse rejects changed compiler inputs, dependency locks and generated metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "canvas-parser-cache-"));
  const source = "packages/ui/example.canvas.tsx";
  const inputs = new Map(parserInputs.map((path) => [path, "original compiler input"]));
  inputs.set(
    catalogMetadata[0],
    JSON.stringify({
      stories: [
        { source, id: "ui-example--default", suite: "ui", title: "Example", name: "Default", exportName: "Default" },
      ],
    }),
  );
  inputs.set(catalogMetadata[1], JSON.stringify({ [source]: { hash: digest("original source") } }));
  try {
    await Promise.all([...inputs].map(([path, content]) => Bun.write(join(root, path), content)));
    await Bun.write(
      join(root, "extensions/canvas/src/catalog/generated/native-manifest.json"),
      JSON.stringify({
        hashes: Object.fromEntries([...inputs].map(([path, content]) => [path, digest(content)])),
      }),
    );
    const cached = (await readStoryParserCache(root)).get(source)!;
    expect(cached.hash).toBe(digest("original source"));
    expect(cached.parsed.stories).toEqual([{ id: "example--default", name: "Default", exportName: "Default" }]);
    for (const [path, content] of inputs) {
      await Bun.write(join(root, path), `${content}\nchanged`);
      expect((await readStoryParserCache(root)).size).toBe(0);
      await Bun.write(join(root, path), content);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
