import type { DataTableThemeColor } from "./types";

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const darkTextColor = "#111827";
const lightTextColor = "#ffffff";
const darkColorTarget = "#000000";
const readableContrastRatio = 4.5;

const expandShortHex = (hex: string) =>
  hex
    .split("")
    .map((character) => character + character)
    .join("");

export const parseHexColor = (color: string) => {
  const normalized = color.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  const expandedHex = hex.length === 3 ? expandShortHex(hex) : hex;
  if (!/^[\da-f]{6}$/i.test(expandedHex)) return null;

  return {
    r: Number.parseInt(expandedHex.slice(0, 2), 16),
    g: Number.parseInt(expandedHex.slice(2, 4), 16),
    b: Number.parseInt(expandedHex.slice(4, 6), 16),
  };
};

const toLinearChannel = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (color: RgbColor) =>
  0.2126 * toLinearChannel(color.r) + 0.7152 * toLinearChannel(color.g) + 0.0722 * toLinearChannel(color.b);

const contrastRatio = (foreground: RgbColor, background: RgbColor) => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const toHexColor = (color: RgbColor) => {
  const toHexChannel = (channel: number) => Math.round(channel).toString(16).padStart(2, "0");
  return `#${toHexChannel(color.r)}${toHexChannel(color.g)}${toHexChannel(color.b)}`;
};

const mixRgbColors = (start: RgbColor, end: RgbColor, endWeight: number) => ({
  r: start.r * (1 - endWeight) + end.r * endWeight,
  g: start.g * (1 - endWeight) + end.g * endWeight,
  b: start.b * (1 - endWeight) + end.b * endWeight,
});

export const contrastRatioForHexColors = (foregroundColor: string, backgroundColor: string) => {
  const foreground = parseHexColor(foregroundColor);
  const background = parseHexColor(backgroundColor);
  if (!foreground || !background) return 0;
  return contrastRatio(foreground, background);
};

const findMatchingForeground = (background: RgbColor, target: RgbColor) => {
  for (let step = 1; step <= 50; step += 1) {
    const candidate = mixRgbColors(background, target, step / 50);
    if (contrastRatio(candidate, background) >= readableContrastRatio) {
      return { color: toHexColor(candidate), step };
    }
  }

  return { color: toHexColor(target), step: 50 };
};

export const resolveReadableTextColor = (backgroundColor: string) => {
  const background = parseHexColor(backgroundColor);
  if (!background) return darkTextColor;

  const darkText = parseHexColor(darkColorTarget)!;
  const lightText = parseHexColor(lightTextColor)!;
  const darkerMatch = findMatchingForeground(background, darkText);
  const lighterMatch = findMatchingForeground(background, lightText);

  return darkerMatch.step <= lighterMatch.step ? darkerMatch.color : lighterMatch.color;
};

export const mixHexColors = (startColor: string, endColor: string, startWeight: number) => {
  const start = parseHexColor(startColor);
  const end = parseHexColor(endColor);
  if (!start || !end) return null;

  return toHexColor(mixRgbColors(start, end, 1 - startWeight));
};

export const resolveColorCellStyle = (color: DataTableThemeColor) => {
  const lightForeground = color.foreground?.light ?? resolveReadableTextColor(color.light);
  const darkForeground = color.foreground?.dark ?? resolveReadableTextColor(color.dark);

  return {
    backgroundColor: `light-dark(${color.light}, ${color.dark})`,
    color: `light-dark(${lightForeground}, ${darkForeground})`,
  };
};
