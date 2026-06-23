import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { injectConfig, resolveFilePath, resolveMimeType } from "./serve-dashboard";

describe("resolveMimeType", () => {
  test("returns correct type for known extensions", () => {
    expect(resolveMimeType(".html")).toBe("text/html");
    expect(resolveMimeType(".js")).toBe("application/javascript");
    expect(resolveMimeType(".css")).toBe("text/css");
  });

  test("returns octet-stream for unknown extensions", () => {
    expect(resolveMimeType(".xyz")).toBe("application/octet-stream");
  });
});

describe("injectConfig", () => {
  test("makes runtime config available before the head closes", () => {
    const html = "<html><head><title>Dashboard</title></head><body></body></html>";
    const config = { apiBaseUrl: "http://localhost:3000", version: "dev" };
    const result = injectConfig(html, config);
    const scriptMatch = result.match(/<script>(.*?)<\/script><\/head>/);
    const context = { window: {} as { __PSTDIO_CONFIG__?: typeof config } };

    expect(scriptMatch?.[1]).toBeString();
    runInNewContext(scriptMatch?.[1] ?? "", context);

    expect(context.window.__PSTDIO_CONFIG__).toEqual(config);
  });

  test("returns html unchanged when no </head>", () => {
    const html = "<html><body></body></html>";
    const result = injectConfig(html, { apiBaseUrl: "http://localhost:3000" });
    expect(result).toBe(html);
  });
});

describe("resolveFilePath", () => {
  test("returns index.html for root path", () => {
    const root = mkdtempSync(join(tmpdir(), "dash-serve-"));
    writeFileSync(join(root, "index.html"), "<html></html>");

    const result = resolveFilePath(root, "/");
    expect(result).toEqual({ kind: "file", filePath: join(root, "index.html") });
  });

  test("returns exact file when it exists", () => {
    const root = mkdtempSync(join(tmpdir(), "dash-serve-"));
    const assetsDir = join(root, "assets");
    mkdirSync(assetsDir);
    writeFileSync(join(assetsDir, "app.js"), "console.log('hi')");

    const result = resolveFilePath(root, "/assets/app.js");
    expect(result).toEqual({ kind: "file", filePath: join(assetsDir, "app.js") });
  });

  test("falls back to index.html for extensionless paths (SPA routing)", () => {
    const root = mkdtempSync(join(tmpdir(), "dash-serve-"));
    writeFileSync(join(root, "index.html"), "<html></html>");

    const result = resolveFilePath(root, "/projects/123");
    expect(result).toEqual({ kind: "fallback", filePath: join(root, "index.html") });
  });

  test("returns null for missing file with extension", () => {
    const root = mkdtempSync(join(tmpdir(), "dash-serve-"));

    const result = resolveFilePath(root, "/missing.js");
    expect(result).toBeNull();
  });
});
