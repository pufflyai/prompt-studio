import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readExtensionIcon } from "./extension-icon";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "extension-icon-"));
  roots.push(root);
  mkdirSync(join(root, "assets"));
  writeFileSync(
    join(root, "assets/logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>',
  );
  return root;
};

test("resolves extension-relative SVG bytes while preserving Lucide names", () => {
  const root = fixture();
  const icon = readExtensionIcon(root, "./assets/logo.svg");
  expect(icon?.startsWith("data:image/svg+xml;base64,")).toBe(true);
  expect(Buffer.from(icon!.split(",")[1], "base64").toString()).toContain('viewBox="0 0 10 10"');
  expect(readExtensionIcon(root, "gallery-thumbnails")).toBe("gallery-thumbnails");
  expect(readExtensionIcon(root, undefined)).toBeUndefined();
  expect(readExtensionIcon(root, "gallery_thumbnails")).toBe("gallery_thumbnails");
  expect(readExtensionIcon(root, "unknown icon name")).toBe("unknown icon name");
});

test("refuses missing SVG files and paths or symlinks outside the owning package", () => {
  const root = fixture();
  const outside = fixture();
  symlinkSync(join(outside, "assets/logo.svg"), join(root, "assets/outside.svg"));
  for (const path of ["./../logo.svg", "./assets/missing.svg", "./assets/outside.svg", "./assets/logo.png"]) {
    expect(() => readExtensionIcon(root, path)).toThrow();
  }
});

// A package cannot make a project listing synchronously read an unbounded icon.
test("bounds SVG reads at 256 KiB", () => {
  const root = fixture();
  const path = join(root, "assets/logo.svg");
  writeFileSync(path, " ".repeat(256 * 1024));
  expect(readExtensionIcon(root, "./assets/logo.svg")).toStartWith("data:image/svg+xml;base64,");
  writeFileSync(path, " ".repeat(256 * 1024 + 1));
  expect(() => readExtensionIcon(root, "./assets/logo.svg")).toThrow("256 KiB");
});
