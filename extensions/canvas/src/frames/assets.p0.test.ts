import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import manifest from "../catalog/generated/frame-manifest.json";
import { createFrameAssetLoader } from "./asset-loader";
import { readFrameAssets } from "./module-graph";

test("cold frame assets decode only their dependency graph and reuse immutable module blobs", async () => {
  const frameBootstrap = createFrameAssetLoader((request) =>
    readFrameAssets(manifest, request, (path) => Bun.file(resolve(import.meta.dir, "../..", path)).text()),
  );
  const source = "packages/ui/src/components/primitives/button.canvas.tsx";
  const button = await frameBootstrap(source);
  expect(await frameBootstrap(source)).toBe(button);
  expect(Object.keys(button.scripts).length).toBeLessThan(Object.keys(manifest.modules).length);
  const native = await frameBootstrap("$native:project-form");
  const shared = Object.keys(button.scripts).find((name) => native.scripts[name]);
  expect(shared).toBeDefined();
  expect(button.scripts[shared!]).toBe(native.scripts[shared!]);
  expect(button.scripts[shared!].type.split(";")[0]).toBe("text/javascript");
  expect(await button.scripts[shared!].text()).toBe(
    gunzipSync(
      Buffer.from(
        await Bun.file(
          resolve(import.meta.dir, "../..", manifest.modules[shared! as keyof typeof manifest.modules].file),
        ).text(),
        "base64",
      ),
    ).toString(),
  );
  await expect(frameBootstrap("missing-source")).rejects.toThrow("Missing preview source");
});
