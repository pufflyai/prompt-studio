import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveStaticStorybook } from "./static-storybook-server";

test("serves prebuilt Storybook pages and nested assets with their content types", async () => {
  const root = mkdtempSync(join(tmpdir(), "static-storybook-"));
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "index.html"), "<html>Storybook manager</html>");
  writeFileSync(join(root, "iframe.html"), "<html>Storybook preview</html>");
  writeFileSync(join(root, "assets/story.js"), "export const story = 'ready';");
  const server = serveStaticStorybook(root, 0);
  try {
    const manager = await fetch(server.url);
    expect(manager.status).toBe(200);
    expect(await manager.text()).toBe("<html>Storybook manager</html>");
    const preview = await fetch(new URL("iframe.html?id=fixture--default", server.url));
    expect(preview.headers.get("content-type")).toContain("text/html");
    expect(await preview.text()).toBe("<html>Storybook preview</html>");
    const script = await fetch(new URL("assets/story.js", server.url));
    expect(script.headers.get("content-type")).toContain("javascript");
    expect(await script.text()).toBe("export const story = 'ready';");
  } finally {
    server.stop(true);
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails at startup when the prebuilt Storybook artifact is missing", () => {
  const root = mkdtempSync(join(tmpdir(), "missing-storybook-"));
  try {
    expect(() => serveStaticStorybook(root, 0)).toThrow("Prebuilt Storybook not found");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
