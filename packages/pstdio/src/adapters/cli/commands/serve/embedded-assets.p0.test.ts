import { describe, expect, test } from "bun:test";
import { loadEmbeddedAssets, resolveMimeType } from "./embedded-assets";

test.each([
  "..\\..\\pstdio-dashboard\\dist\\index.html",
  "packages/pstdio-dashboard/dist/index.html",
])("loads dashboard assets from embedded name %s", (name) => {
  const previous = globalThis.Bun.embeddedFiles;
  const file = Object.assign(new Blob(["<html></html>"]), {
    name,
  });
  (globalThis.Bun as unknown as { embeddedFiles: unknown[] }).embeddedFiles = [file];

  try {
    expect(loadEmbeddedAssets().get("index.html")).toBe(file);
  } finally {
    (globalThis.Bun as unknown as { embeddedFiles: unknown[] }).embeddedFiles = [...previous];
  }
});

test.each([
  "/$bunfs/root/..",
  "B:\\~BUN\\root\\..",
])("loads dashboard HTML and nested assets from a multi-entry compiled root: %s", (root) => {
  const previous = globalThis.Bun.embeddedFiles;
  const html = Object.assign(new Blob(["<html></html>"]), { name: `${root}/pstdio-dashboard/dist/index.html` });
  const script = Object.assign(new Blob(["export {}"]), { name: `${root}/pstdio-dashboard/dist/assets/main.js` });
  (globalThis.Bun as unknown as { embeddedFiles: unknown[] }).embeddedFiles = [html, script];
  try {
    const assets = loadEmbeddedAssets();
    expect(assets.get("index.html")).toBe(html);
    expect(assets.get("assets/main.js")).toBe(script);
  } finally {
    (globalThis.Bun as unknown as { embeddedFiles: unknown[] }).embeddedFiles = [...previous];
  }
});

describe("resolveMimeType", () => {
  test("resolves common web asset types", () => {
    expect(resolveMimeType("index.html")).toBe("text/html");
    expect(resolveMimeType("app.js")).toBe("application/javascript");
    expect(resolveMimeType("style.css")).toBe("text/css");
    expect(resolveMimeType("data.json")).toBe("application/json");
    expect(resolveMimeType("logo.svg")).toBe("image/svg+xml");
    expect(resolveMimeType("photo.png")).toBe("image/png");
  });

  test("resolves font types", () => {
    expect(resolveMimeType("font.woff")).toBe("font/woff");
    expect(resolveMimeType("font.woff2")).toBe("font/woff2");
    expect(resolveMimeType("font.ttf")).toBe("font/ttf");
  });

  test("falls back to octet-stream for unknown extensions", () => {
    expect(resolveMimeType("file.xyz")).toBe("application/octet-stream");
    expect(resolveMimeType("file")).toBe("application/octet-stream");
  });
});
