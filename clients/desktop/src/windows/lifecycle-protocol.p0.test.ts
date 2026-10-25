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
        const response = await readLifecycleAsset(`pstdio://lifecycle/${name}`, root, undefined);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(contentType);
        expect(Buffer.from(await response.arrayBuffer())).toEqual(body);
      }
      expect((await readLifecycleAsset("pstdio://lifecycle/missing.js", root, undefined)).status).toBe(404);
      expect((await readLifecycleAsset("pstdio://other/index.html", root, undefined)).status).toBe(404);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("serves the startup document in the saved theme so its first frame matches", async () => {
    const root = mkdtempSync(join(tmpdir(), "desktop-lifecycle-assets-"));
    try {
      writeFileSync(join(root, "index.html"), '<!doctype html>\n<html lang="en">\n<body></body></html>');
      const appearance = {
        themeId: "lab.monokai",
        mode: "dark" as const,
        tokens: { "colors.bg": "#272822", "colors.bg.menu-item.hover": "rgba(255, 255, 255, 0.1)" },
        backgroundColor: "rgb(39, 40, 34)",
      };

      const themed = await (await readLifecycleAsset("pstdio://lifecycle/index.html", root, appearance)).text();
      const plain = await (await readLifecycleAsset("pstdio://lifecycle/index.html", root, undefined)).text();

      expect(themed).toContain(
        '<html lang="en" class="dark theme-lab.monokai" data-theme="lab.monokai" data-color-mode="dark" ' +
          'style="color-scheme: dark; --chakra-colors-bg: #272822; --chakra-colors-bg-menu-item-hover: rgba(255, 255, 255, 0.1);">',
      );
      expect(plain).toContain('<html lang="en">');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps replacement patterns in theme values as literal text", async () => {
    const root = mkdtempSync(join(tmpdir(), "desktop-lifecycle-assets-"));
    try {
      writeFileSync(join(root, "index.html"), '<!doctype html>\n<html lang="en"><head></head></html>');
      const appearance = { themeId: "x$'", mode: "dark" as const, tokens: {}, backgroundColor: "rgb(0, 0, 0)" };

      const html = await (await readLifecycleAsset("pstdio://lifecycle/index.html", root, appearance)).text();

      expect(html).toContain(`class="dark theme-x$'"`);
      expect(html.match(/<head>/g)).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
