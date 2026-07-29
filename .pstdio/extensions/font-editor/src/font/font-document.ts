import { createHash } from "node:crypto";
import { createFont, type FontEditor, type TTF, woff2 } from "fonteditor-core";
import { deflate, inflate } from "pako";
import type { FontEditorConfig } from "../config";

export type FontArtifact = Uint8Array | string;
export type FontArtifacts = Record<string, FontArtifact>;

export interface GlyphSummary {
  name: string;
  codepoint: string;
  unicode: number;
  advanceWidth: number;
  contours?: TTF.Contour[];
}

export interface FontInspection {
  family: string;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  glyphs: GlyphSummary[];
}

interface AddGlyphInput {
  name: string;
  svg: string;
  codepoint?: string;
  startCodepoint?: string;
  endCodepoint?: string;
}

const pakoDeflate = (value: number[]) => Array.from(deflate(new Uint8Array(value)));
const pakoInflate = (value: number[]) => Array.from(inflate(new Uint8Array(value)));
let woff2Ready: Promise<FontEditor.Woff2> | undefined;

const initWoff2 = () => {
  woff2Ready ??= woff2.init();
  return woff2Ready;
};

const parseCodepoint = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (!/^U\+[0-9A-F]{4,6}$/.test(normalized)) throw new Error(`Invalid codepoint: ${value}`);
  const codepoint = Number.parseInt(normalized.slice(2), 16);
  if (codepoint > 0x10ffff) throw new Error(`Invalid codepoint: ${value}`);
  return codepoint;
};

const formatCodepoint = (value: number) => `U+${value.toString(16).toUpperCase().padStart(4, "0")}`;

const assertGlyphName = (name: string) => {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error("Glyph names must start with a letter and contain lowercase letters, numbers, or hyphens.");
  }
};

const readTtf = (input: Uint8Array | ArrayBuffer | Buffer) =>
  createFont(Buffer.from(input instanceof ArrayBuffer ? new Uint8Array(input) : input), {
    type: "ttf",
    compound2simple: true,
  });

const writeTtf = (font: FontEditor.Font) => new Uint8Array(font.write({ type: "ttf", toBuffer: true }));

const glyphEntries = (font: FontEditor.Font) =>
  font
    .get()
    .glyf.map((glyph, index) => ({ glyph, index }))
    .filter(({ glyph }) => glyph.unicode?.length);

const findGlyph = (font: FontEditor.Font, identifier: string) => {
  const codepoint = /^U\+/i.test(identifier) ? parseCodepoint(identifier) : undefined;
  const match = glyphEntries(font).find(
    ({ glyph }) => glyph.name === identifier || (codepoint !== undefined && glyph.unicode.includes(codepoint)),
  );
  if (!match) throw new Error(`Glyph not found: ${identifier}`);
  return match;
};

const assertUniqueName = (font: FontEditor.Font, name: string, exceptIndex?: number) => {
  if (glyphEntries(font).some(({ glyph, index }) => index !== exceptIndex && glyph.name === name)) {
    throw new Error(`Glyph name already exists: ${name}`);
  }
};

const assertUniqueCodepoint = (font: FontEditor.Font, codepoint: number, exceptIndex?: number) => {
  if (glyphEntries(font).some(({ glyph, index }) => index !== exceptIndex && glyph.unicode.includes(codepoint))) {
    throw new Error(`Codepoint ${formatCodepoint(codepoint)} is already assigned.`);
  }
};

const nextCodepoint = (font: FontEditor.Font, start: string, end: string) => {
  const first = parseCodepoint(start);
  const last = parseCodepoint(end);
  const used = new Set(glyphEntries(font).flatMap(({ glyph }) => glyph.unicode));
  for (let codepoint = first; codepoint <= last; codepoint += 1) {
    if (!used.has(codepoint)) return codepoint;
  }
  throw new Error(`No unused codepoint remains between ${start} and ${end}.`);
};

const updateFontName = (font: FontEditor.Font, family: string) => {
  const name = font.get().name;
  font.getHelper().setName({
    fontFamily: family,
    fontSubFamily: "Regular",
    fullName: family,
    postScriptName: family.replaceAll(" ", "-"),
    uniqueSubFamily: `${family} Regular`,
    version: name.version,
  });
};

export const parseCssGlyphNames = (css: string, cssPrefix: string) => {
  const escapedPrefix = cssPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(
    `\\.${escapedPrefix}([a-z][a-z0-9-]*)::?before\\s*\\{[^}]*content:\\s*["']\\\\([0-9a-fA-F]{4,6})["']`,
    "g",
  );
  return new Map<number, string>(Array.from(css.matchAll(rule), (match) => [Number.parseInt(match[2], 16), match[1]]));
};

export const normalizeFontGlyphs = async (
  input: Uint8Array | ArrayBuffer | Buffer,
  namesByCodepoint: ReadonlyMap<number, string>,
) => {
  const font = readTtf(input);
  const normalized = font.get().glyf.flatMap((glyph) => {
    if (!glyph.unicode?.length) return [glyph];
    return glyph.unicode.map((codepoint, index) => ({
      ...structuredClone(glyph),
      name: namesByCodepoint.get(codepoint) ?? (index === 0 ? glyph.name : `${glyph.name}-${codepoint.toString(16)}`),
      unicode: [codepoint],
    }));
  });
  font.getHelper().setGlyf(normalized);
  font.getHelper().sortGlyf();
  return writeTtf(font);
};

export const inspectFont = async (
  input: Uint8Array | ArrayBuffer | Buffer,
  options: { includeContours?: boolean } = {},
) => {
  const font = readTtf(input);
  const data = font.get();
  const glyphs = glyphEntries(font)
    .map(({ glyph }) => ({
      name: glyph.name,
      codepoint: formatCodepoint(glyph.unicode[0]),
      unicode: glyph.unicode[0],
      advanceWidth: glyph.advanceWidth,
      ...(options.includeContours ? { contours: glyph.contours } : {}),
    }))
    .sort((left, right) => left.unicode - right.unicode);

  return {
    family: data.name.fontFamily,
    unitsPerEm: data.head.unitsPerE,
    ascent: data.hhea.ascent,
    descent: data.hhea.descent,
    glyphs,
  } satisfies FontInspection;
};

export const renameGlyph = async (input: Uint8Array | ArrayBuffer | Buffer, identifier: string, name: string) => {
  assertGlyphName(name);
  const font = readTtf(input);
  const { glyph, index } = findGlyph(font, identifier);
  assertUniqueName(font, name, index);
  glyph.name = name;
  return writeTtf(font);
};

export const setGlyphCodepoint = async (
  input: Uint8Array | ArrayBuffer | Buffer,
  identifier: string,
  value: string,
) => {
  const font = readTtf(input);
  const { glyph, index } = findGlyph(font, identifier);
  const codepoint = parseCodepoint(value);
  assertUniqueCodepoint(font, codepoint, index);
  glyph.unicode = [codepoint];
  return writeTtf(font);
};

export const removeGlyph = async (input: Uint8Array | ArrayBuffer | Buffer, identifier: string) => {
  const font = readTtf(input);
  const { index } = findGlyph(font, identifier);
  font.getHelper().removeGlyf([index]);
  return writeTtf(font);
};

export const addGlyph = async (input: Uint8Array | ArrayBuffer | Buffer, addition: AddGlyphInput) => {
  assertGlyphName(addition.name);
  const font = readTtf(input);
  assertUniqueName(font, addition.name);
  const codepoint = addition.codepoint
    ? parseCodepoint(addition.codepoint)
    : nextCodepoint(font, addition.startCodepoint ?? "U+E800", addition.endCodepoint ?? "U+F8FF");
  assertUniqueCodepoint(font, codepoint);

  const imported = createFont(addition.svg, { type: "svg", combinePath: true });
  const sourceGlyph = imported.get().glyf.find((glyph) => glyph.contours?.length);
  if (!sourceGlyph) throw new Error("The SVG does not contain a usable path.");

  const unitsPerEm = font.get().head.unitsPerE;
  font.getHelper().addGlyf({
    ...structuredClone(sourceGlyph),
    name: addition.name,
    unicode: [codepoint],
    advanceWidth: sourceGlyph.advanceWidth || unitsPerEm,
    leftSideBearing: sourceGlyph.leftSideBearing ?? 0,
  });
  font.getHelper().sortGlyf();
  return writeTtf(font);
};

const toBytes = (value: FontEditor.FontOutput) => {
  if (typeof value === "string") throw new Error("Expected a binary font artifact.");
  return new Uint8Array(value);
};

const joinUrl = (base: string, fileName: string) => `${base.replace(/\/$/, "")}/${fileName}`;

const buildCss = (font: FontInspection, config: FontEditorConfig, hash: string) => {
  const root = joinUrl(config.fontsUrl, config.fileName);
  const selectors = font.glyphs
    .map(
      (glyph) =>
        `.${config.cssPrefix}${glyph.name}::before {
  content: "\\${glyph.unicode.toString(16).padStart(4, "0")}";
}`,
    )
    .join("\n");
  return `@font-face {
  font-family: "${config.family}";
  src: url("${root}.eot?${hash}");
  src:
    url("${root}.eot?${hash}#iefix") format("embedded-opentype"),
    url("${root}.woff2?${hash}") format("woff2"),
    url("${root}.woff?${hash}") format("woff"),
    url("${root}.ttf?${hash}") format("truetype"),
    url("${root}.svg?${hash}#${config.family}") format("svg");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

[class^="${config.cssPrefix}"]::before,
[class*=" ${config.cssPrefix}"]::before {
  font-family: "${config.family}", sans-serif;
  font-style: normal;
  font-weight: normal;
  speak: never;
  display: inline-block;
  text-decoration: inherit;
  width: 1em;
  margin-right: 0.2em;
  text-align: center;
  font-variant: normal;
  text-transform: none;
  line-height: 1em;
  margin-left: 0.2em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

${selectors}
`;
};

export const buildFontArtifacts = async (input: Uint8Array | ArrayBuffer | Buffer, config: FontEditorConfig) => {
  const font = readTtf(input);
  updateFontName(font, config.family);
  await initWoff2();

  const ttf = writeTtf(font);
  const hash = createHash("sha256").update(ttf).digest("hex").slice(0, 8);
  const inspection = await inspectFont(ttf);
  const artifacts: FontArtifacts = {
    [`${config.fileName}.ttf`]: ttf,
    [`${config.fileName}.eot`]: toBytes(font.write({ type: "eot", toBuffer: true })),
    [`${config.fileName}.woff`]: toBytes(font.write({ type: "woff", toBuffer: true, deflate: pakoDeflate })),
    [`${config.fileName}.woff2`]: toBytes(font.write({ type: "woff2", toBuffer: true })),
    [`${config.fileName}.svg`]: font.write({ type: "svg" }),
    [config.cssFile]: buildCss(inspection, config, hash),
  };
  return artifacts;
};

const readArtifactFont = async (value: FontArtifact, type: FontEditor.FontType) => {
  if (type === "woff2") await initWoff2();
  const input = type === "svg" && typeof value !== "string" ? new TextDecoder().decode(value) : value;
  return createFont(typeof input === "string" ? input : Buffer.from(input), {
    type,
    compound2simple: true,
    inflate: pakoInflate,
  });
};

const semanticMap = (font: FontEditor.Font) =>
  glyphEntries(font)
    .map(({ glyph }) => `${glyph.name}:${glyph.unicode[0]}`)
    .sort();

export const verifyFontArtifacts = async (artifacts: FontArtifacts, config: FontEditorConfig) => {
  const expected = await readArtifactFont(artifacts[`${config.fileName}.ttf`], "ttf");
  const expectedMap = semanticMap(expected);

  for (const format of config.formats) {
    const artifact = artifacts[`${config.fileName}.${format}`];
    if (!artifact) throw new Error(`Missing generated ${format.toUpperCase()} font.`);
    const font = await readArtifactFont(artifact, format);
    if (JSON.stringify(semanticMap(font)) !== JSON.stringify(expectedMap)) {
      throw new Error(`${format.toUpperCase()} glyph mapping does not match the TTF source.`);
    }
  }

  const css = artifacts[config.cssFile];
  if (typeof css !== "string") throw new Error("Missing generated CSS.");
  for (const { glyph } of glyphEntries(expected)) {
    const selector = `.${config.cssPrefix}${glyph.name}::before`;
    const content = `\\${glyph.unicode[0].toString(16).padStart(4, "0")}`;
    if (!css.includes(selector) || !css.includes(content)) {
      throw new Error(`CSS mapping is missing ${glyph.name}.`);
    }
  }

  return {
    glyphCount: expectedMap.length,
    formats: [...config.formats],
  };
};
