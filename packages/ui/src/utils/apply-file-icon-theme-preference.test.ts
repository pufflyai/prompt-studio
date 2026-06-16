import { describe, expect, test } from "bun:test";

import { type FileIconThemePreferenceOption, resolveFileIconGlyph } from "./apply-file-icon-theme-preference";

const theme: FileIconThemePreferenceOption = {
  id: "pstdio-base-themes.seti",
  definitions: {
    _file: { fontCharacter: "\\E001", fontColor: "#aaaaaa" },
    _folder: { fontCharacter: "\\E002", fontColor: "#bbbbbb" },
    _typescript: { fontCharacter: "\\E099", fontColor: "#519ABA" },
    _json: { fontCharacter: "\\E10A", fontColor: "#cbcb41" },
    _spec: { fontCharacter: "\\E0AA" },
  },
  fileExtensions: { ts: "_typescript", "spec.ts": "_spec" },
  fileNames: { "package.json": "_json" },
  defaults: { file: "_file", folder: "_folder" },
  fonts: [{ fontFamily: "pstdio-base-themes.seti-seti", src: [{ url: "data:font/woff;base64,AA" }] }],
};

describe("resolveFileIconGlyph", () => {
  test("matches by exact file name before extension", () => {
    const glyph = resolveFileIconGlyph(theme, "package.json");
    expect(glyph?.fontCharacter).toBe(String.fromCodePoint(0xe10a));
    expect(glyph?.fontColor).toBe("#cbcb41");
    expect(glyph?.fontFamily).toBe("pstdio-base-themes.seti-seti");
  });

  test("prefers the longest compound extension", () => {
    expect(resolveFileIconGlyph(theme, "button.spec.ts")?.fontCharacter).toBe(String.fromCodePoint(0xe0aa));
    expect(resolveFileIconGlyph(theme, "button.ts")?.fontCharacter).toBe(String.fromCodePoint(0xe099));
  });

  test("falls back to the default file glyph for unknown extensions", () => {
    expect(resolveFileIconGlyph(theme, "notes.unknown")?.fontCharacter).toBe(String.fromCodePoint(0xe001));
  });

  test("resolves directories to the default folder glyph", () => {
    expect(resolveFileIconGlyph(theme, "src", true)?.fontCharacter).toBe(String.fromCodePoint(0xe002));
  });

  test("returns undefined without an active theme", () => {
    expect(resolveFileIconGlyph(undefined, "index.ts")).toBeUndefined();
  });
});
