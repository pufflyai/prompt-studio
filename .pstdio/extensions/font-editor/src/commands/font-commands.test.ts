import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMemoryRepoFiles } from "@pstdio/sdk/testing";
import { defaultFontEditorConfig } from "../config";
import { parseCssGlyphNames } from "../font/font-document";
import { fontEditorCommands } from "./font-commands";

const createContext = async () => {
  const projectFiles = createMemoryRepoFiles();
  const font = defaultFontEditorConfig.source;
  const css = `${defaultFontEditorConfig.outputDir}/${defaultFontEditorConfig.cssFile}`;
  for (const path of [font, css]) {
    await projectFiles.writeBytes(
      path,
      new Uint8Array(await readFile(resolve(import.meta.dir, "../../../../..", path))),
    );
  }
  return { projectFiles };
};

test("dashboard inspection reads the project font and glyph mappings", async () => {
  const ctx = await createContext();
  const before = new Map(ctx.projectFiles.files);
  const result = await fontEditorCommands.inspect.run(ctx as never, {});
  const css = await ctx.projectFiles.readText(
    `${defaultFontEditorConfig.outputDir}/${defaultFontEditorConfig.cssFile}`,
  );
  const names = parseCssGlyphNames(css, defaultFontEditorConfig.cssPrefix);

  expect(result.glyphs.map((glyph) => [glyph.unicode, glyph.name])).toEqual([...names]);
  expect(ctx.projectFiles.files).toEqual(before);
});

test("inline SVG command adds a glyph and writes verified project font outputs", async () => {
  const ctx = await createContext();
  const before = await fontEditorCommands.inspect.run(ctx as never, {});
  const result = await fontEditorCommands["glyph.add"].run(ctx as never, {
    name: "command-test-square",
    svg: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>',
  });

  expect(result.glyph.name).toBe("command-test-square");
  expect((await fontEditorCommands.inspect.run(ctx as never, {})).glyphs).toHaveLength(before.glyphs.length + 1);
  expect(await fontEditorCommands.verify.run(ctx as never, {})).toEqual({
    glyphCount: before.glyphs.length + 1,
    formats: ["eot", "svg", "ttf", "woff", "woff2"],
  });
});
