import { expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import archive from "../catalog/generated/frame-bundle";
import { frameBootstrap } from "./assets";

test("cold frame assets decode only their dependency graph and reuse immutable module blobs", async () => {
  const source = "packages/ui/src/components/primitives/button.canvas.tsx";
  const button = await frameBootstrap(source);
  expect(await frameBootstrap(source)).toBe(button);
  expect(Object.keys(button.scripts).length).toBeLessThan(Object.keys(archive.scripts).length);
  const native = await frameBootstrap("$native:project-form");
  const shared = Object.keys(button.scripts).find((name) => native.scripts[name]);
  expect(shared).toBeDefined();
  expect(button.scripts[shared!]).toBe(native.scripts[shared!]);
  expect(button.scripts[shared!].type.split(";")[0]).toBe("text/javascript");
  expect(await button.scripts[shared!].text()).toBe(
    gunzipSync(Buffer.from(archive.scripts[shared!], "base64")).toString(),
  );
  await expect(frameBootstrap("missing-source")).rejects.toThrow("Missing preview source");
});
