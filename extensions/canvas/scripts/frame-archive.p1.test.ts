import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type { FrameManifest } from "../src/frames/module-graph";
import { publishFrameArchive } from "./frame-archive";

test("frame archives rewrite emitted dependencies and preserve source listings", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "canvas-frame-archive-"));
  const code = [
    'import { value } from "./shared.js";',
    "export const load = () => import('./shared.js');",
    'export const listing = `import x from "./utils.js"`;',
    "export const path = './example.js';",
  ].join("\n");
  try {
    await publishFrameArchive(
      root,
      [
        {
          type: "chunk",
          fileName: "entry.js",
          isEntry: true,
          code,
          modules: { [resolve(root, "catalog.ts")]: {} },
          imports: ["shared.js"],
          dynamicImports: ["shared.js"],
        },
        { type: "chunk", fileName: "shared.js", code: "export const value = 1;" },
      ],
      { repoRoot: root, sources: {}, projects: {}, nativeSources: {}, catalogSource: "catalog.ts" },
    );
    const manifest: FrameManifest = JSON.parse(await readFile(resolve(root, "frame-manifest.json"), "utf8"));
    const file = resolve(root, "frame-modules", basename(manifest.modules[manifest.entry].file));
    const archived = gunzipSync(Buffer.from(await readFile(file, "utf8"), "base64")).toString();
    expect(archived).toBe(
      code
        .replaceAll('"./shared.js"', '"canvas-preview:shared.js"')
        .replaceAll("'./shared.js'", "'canvas-preview:shared.js'"),
    );
    expect(manifest.modules[manifest.entry].imports).toEqual(["shared.js"]);
    expect(manifest.modules[manifest.entry].dynamicImports).toEqual(["shared.js"]);
    expect(manifest.modules[manifest.entry].bytes).toBe(Buffer.byteLength(archived));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
