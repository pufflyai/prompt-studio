import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defaultFontEditorConfig } from "../config";
import {
  addGlyph,
  buildFontArtifacts,
  inspectFont,
  normalizeFontGlyphs,
  parseCssGlyphNames,
  removeGlyph,
  renameGlyph,
  setGlyphCodepoint,
  verifyFontArtifacts,
} from "./font-document";

const sourcePath = resolve(import.meta.dir, "../../../../../packages/ui/public/font/prompt-studio-icons.ttf");
const cssPath = resolve(import.meta.dir, "../../../../../packages/ui/public/font/css/prompt-studio-icons.css");
const source = () => readFile(sourcePath);
const normalizedSource = async () => {
  const [font, css] = await Promise.all([source(), readFile(cssPath, "utf8")]);
  return normalizeFontGlyphs(font, parseCssGlyphNames(css, "icon-"));
};

describe("font document", () => {
  test("inspects the existing Prompt Studio icon font", async () => {
    const result = await inspectFont(await normalizedSource());

    expect(result.glyphs).toHaveLength(220);
    expect(result.glyphs).toContainEqual(
      expect.objectContaining({
        name: "data-intiger",
        codepoint: "U+E805",
      }),
    );
  });

  test("renames a glyph without changing its codepoint or contours", async () => {
    const input = await normalizedSource();
    const before = await inspectFont(input, { includeContours: true });
    const updated = await renameGlyph(input, "data-intiger", "data-integer");
    const after = await inspectFont(updated, { includeContours: true });

    const oldGlyph = before.glyphs.find((glyph) => glyph.name === "data-intiger");
    const newGlyph = after.glyphs.find((glyph) => glyph.name === "data-integer");
    expect(newGlyph?.codepoint).toBe("U+E805");
    expect(newGlyph?.contours).toEqual(oldGlyph?.contours);
    expect(after.glyphs.some((glyph) => glyph.name === "data-intiger")).toBe(false);
  });

  test("adds, moves, and removes an SVG glyph", async () => {
    const input = await normalizedSource();
    const svg = '<svg viewBox="0 0 1000 1000"><path d="M100 100H900V900H100Z"/></svg>';
    const added = await addGlyph(input, { name: "agent-spark", svg });
    const inspected = await inspectFont(added);
    const glyph = inspected.glyphs.find((candidate) => candidate.name === "agent-spark");

    expect(glyph?.codepoint).toBe("U+E825");

    const moved = await setGlyphCodepoint(added, "agent-spark", "U+F100");
    expect((await inspectFont(moved)).glyphs).toContainEqual(
      expect.objectContaining({ name: "agent-spark", codepoint: "U+F100" }),
    );

    const removed = await removeGlyph(moved, "agent-spark");
    expect((await inspectFont(removed)).glyphs.some((candidate) => candidate.name === "agent-spark")).toBe(false);
  });

  test("builds and verifies every shipped font format and CSS mapping", async () => {
    const artifacts = await buildFontArtifacts(await normalizedSource(), defaultFontEditorConfig);
    const verified = await verifyFontArtifacts(artifacts, defaultFontEditorConfig);

    expect(Object.keys(artifacts).sort()).toEqual([
      "css/prompt-studio-icons.css",
      "prompt-studio-icons.eot",
      "prompt-studio-icons.svg",
      "prompt-studio-icons.ttf",
      "prompt-studio-icons.woff",
      "prompt-studio-icons.woff2",
    ]);
    expect(verified.glyphCount).toBe(220);
    expect(verified.formats).toEqual(["eot", "svg", "ttf", "woff", "woff2"]);
  });

  test("rejects duplicate names and codepoints", async () => {
    const input = await normalizedSource();
    const svg = '<svg viewBox="0 0 1000 1000"><path d="M100 100H900V900H100Z"/></svg>';

    await expect(addGlyph(input, { name: "data-intiger", svg })).rejects.toThrow("already exists");
    await expect(addGlyph(input, { name: "agent-spark", svg, codepoint: "U+E805" })).rejects.toThrow(
      "already assigned",
    );
  });
});
