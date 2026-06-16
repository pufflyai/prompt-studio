import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, normalize as normalizePath, resolve } from "node:path";
import type { RuntimeFileIconThemeFont } from "../../types/runtime";
import { isRecord } from "./accumulator";

const isSafeRelativeAsset = (path: string) => {
  const normalized = normalizePath(path);
  return !path.includes("\0") && !isAbsolute(path) && normalized !== ".." && !normalized.startsWith(`..${"/"}`);
};

const FONT_MIME: Record<string, string> = {
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
};

const mimeFor = (format: string | undefined, path: string) => {
  const ext = (format ?? path.split(".").pop() ?? "").toLowerCase();
  return FONT_MIME[ext] ?? "font/woff";
};

const inlineFontSrc = (entry: unknown, baseDir: string, invalidPaths: string[]) => {
  if (!isRecord(entry) || typeof entry.path !== "string") return undefined;
  const fontPath = entry.path;
  const resolved = resolve(baseDir, fontPath);
  if (!isSafeRelativeAsset(fontPath) || !existsSync(resolved)) {
    invalidPaths.push(fontPath);
    return undefined;
  }
  const format = typeof entry.format === "string" ? entry.format : undefined;
  const base64 = readFileSync(resolved).toString("base64");
  return { url: `data:${mimeFor(format, fontPath)};base64,${base64}`, ...(format ? { format } : {}) };
};

const inlineFont = (font: unknown, baseDir: string, themeId: string, invalidPaths: string[]) => {
  if (!isRecord(font) || !Array.isArray(font.src)) return undefined;
  const src = font.src.map((entry) => inlineFontSrc(entry, baseDir, invalidPaths)).filter((entry) => entry != null);
  if (src.length === 0) return undefined;
  return {
    fontFamily: `${themeId}-${typeof font.id === "string" ? font.id : ""}`,
    src,
    ...(typeof font.weight === "string" ? { weight: font.weight } : {}),
    ...(typeof font.style === "string" ? { style: font.style } : {}),
  };
};

// Inline each font as a data: URL so the browser can register it via @font-face without a dedicated asset route.
export const collectIconFontAssets = (assetPath: string, iconTheme: Record<string, unknown>, themeId: string) => {
  const invalidPaths: string[] = [];
  const raw = iconTheme.fonts;
  if (!Array.isArray(raw)) return { fonts: [] as RuntimeFileIconThemeFont[], invalidPaths };

  const baseDir = dirname(assetPath);
  const fonts = raw
    .map((font) => inlineFont(font, baseDir, themeId, invalidPaths))
    .filter((font): font is RuntimeFileIconThemeFont => font != null);

  return { fonts, invalidPaths };
};
