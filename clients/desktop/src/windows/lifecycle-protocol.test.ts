import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readLifecycleAsset, resolveLifecycleAssetPath } from "./lifecycle-protocol";

describe("desktop lifecycle protocol", () => {
  test("resolves only lifecycle assets inside the renderer root", () => {
    expect(resolveLifecycleAssetPath("pstdio://lifecycle/", "/app/renderer")).toBe(resolve("/app/renderer/index.html"));
    expect(resolveLifecycleAssetPath("pstdio://lifecycle/assets/app.js", "/app/renderer")).toBe(
      resolve("/app/renderer/assets/app.js"),
    );
    expect(resolveLifecycleAssetPath("pstdio://other/index.html", "/app/renderer")).toBeNull();
    expect(resolveLifecycleAssetPath("pstdio://lifecycle/%2e%2e/secret", "/app/renderer")).toBeNull();
  });

  test("serves packaged document, script, stylesheet, and font bytes with their content types", async () => {
    const root = mkdtempSync(join(tmpdir(), "desktop-lifecycle-assets-"));
    try {
      for (const [name, contentType] of [
        ["index.html", "text/html"],
        ["app.js", "text/javascript"],
        ["app.css", "text/css"],
        ["font.woff2", "font/woff2"],
      ]) {
        const body = Buffer.from([0, 32, 65, 128, 255]);
        writeFileSync(join(root, name), body);
        const response = await readLifecycleAsset(`pstdio://lifecycle/${name}`, root);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(contentType);
        expect(Buffer.from(await response.arrayBuffer())).toEqual(body);
      }
      expect((await readLifecycleAsset("pstdio://lifecycle/missing.js", root)).status).toBe(404);
      expect((await readLifecycleAsset("pstdio://other/index.html", root)).status).toBe(404);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
