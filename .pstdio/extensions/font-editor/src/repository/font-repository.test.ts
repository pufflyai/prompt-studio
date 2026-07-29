import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { defaultFontEditorConfig, FONT_EDITOR_CONFIG_PATH } from "../config";
import { parseCssGlyphNames } from "../font/font-document";
import {
  buildRepositoryFont,
  inspectRepositoryFont,
  renameRepositoryGlyph,
  updateRepositoryConfig,
  verifyRepositoryFont,
} from "./font-repository";

const fontPath = resolve(import.meta.dir, "../../../../../packages/ui/public/font/prompt-studio-icons.ttf");
const cssPath = resolve(import.meta.dir, "../../../../../packages/ui/public/font/css/prompt-studio-icons.css");

class MemoryMount implements ArtifactMount {
  files = new Map<string, Uint8Array>();
  writes: string[] = [];

  async exists(path: string) {
    return this.files.has(path);
  }

  async readText(path: string) {
    const value = this.files.get(path);
    if (!value) throw new Error(`Missing ${path}`);
    return new TextDecoder().decode(value);
  }

  async writeText(path: string, value: string) {
    this.writes.push(path);
    this.files.set(path, new TextEncoder().encode(value));
  }

  async readBytes(path: string) {
    const value = this.files.get(path);
    if (!value) throw new Error(`Missing ${path}`);
    return value;
  }

  async writeBytes(path: string, value: Uint8Array) {
    this.writes.push(path);
    this.files.set(path, value);
  }

  async list() {
    return Array.from(this.files, ([path, value]) => ({ path, size: value.byteLength }));
  }

  async listDirs() {
    return [];
  }

  async delete(path: string) {
    this.files.delete(path);
  }
}

const createMount = async () => {
  const mount = new MemoryMount();
  mount.files.set(defaultFontEditorConfig.source, new Uint8Array(await readFile(fontPath)));
  mount.files.set(
    `${defaultFontEditorConfig.outputDir}/${defaultFontEditorConfig.cssFile}`,
    new TextEncoder().encode(await readFile(cssPath, "utf8")),
  );
  return mount;
};

describe("font repository", () => {
  test("inspects all semantic glyph mappings from the current font and CSS", async () => {
    const mount = await createMount();
    const result = await inspectRepositoryFont(mount);
    const cssNames = parseCssGlyphNames(await readFile(cssPath, "utf8"), defaultFontEditorConfig.cssPrefix);

    expect(result.glyphs.map((glyph) => [glyph.unicode, glyph.name])).toEqual([...cssNames]);
    expect(mount.writes).toEqual([]);
  });

  test("commits a rename only after every generated artifact verifies", async () => {
    const mount = await createMount();
    const before = await inspectRepositoryFont(mount);
    const original = before.glyphs[0];
    if (!original) throw new Error("Expected the font to contain a glyph.");
    const result = await renameRepositoryGlyph(mount, original.name, "test-renamed-glyph");

    expect(result.glyph.name).toBe("test-renamed-glyph");
    expect(mount.writes).toContain(FONT_EDITOR_CONFIG_PATH);
    expect(await verifyRepositoryFont(mount)).toEqual({
      glyphCount: before.glyphs.length,
      formats: ["eot", "svg", "ttf", "woff", "woff2"],
    });
  });

  test("leaves every output unchanged when an edit is invalid", async () => {
    const mount = await createMount();
    const before = new Map(mount.files);
    const [first, second] = (await inspectRepositoryFont(mount)).glyphs;
    if (!first || !second) throw new Error("Expected the font to contain at least two glyphs.");

    await expect(renameRepositoryGlyph(mount, first.name, second.name)).rejects.toThrow("already exists");
    expect(mount.writes).toEqual([]);
    expect(mount.files).toEqual(before);
  });

  test("moves the canonical TTF when output settings change", async () => {
    const mount = await createMount();
    const config = await updateRepositoryConfig(mount, {
      family: "product-icons",
      fileName: "product-icons",
      outputDir: "packages/ui/public/product-font",
    });

    expect(config.source).toBe("packages/ui/public/product-font/product-icons.ttf");
    expect(await mount.exists(config.source)).toBe(true);
    expect(await inspectRepositoryFont(mount)).toMatchObject({ family: "product-icons" });
  });

  test("builds the current source without changing glyph identities", async () => {
    const mount = await createMount();
    const before = await inspectRepositoryFont(mount);
    const result = await buildRepositoryFont(mount);
    const after = await inspectRepositoryFont(mount);

    expect(result.glyphCount).toBe(before.glyphs.length);
    expect(after.glyphs.map(({ name, codepoint }) => ({ name, codepoint }))).toEqual(
      before.glyphs.map(({ name, codepoint }) => ({ name, codepoint })),
    );
  });
});
