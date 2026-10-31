import { luminance } from "./color";

export type ThemeMode = "light" | "dark";

export interface VsCodeColorTheme {
  type?: string;
  colors?: Record<string, string>;
  pstdio?: { colors?: Record<string, string> };
  tokenColors?: { scope?: string | string[]; settings?: { foreground?: string; fontStyle?: string } }[];
}

export interface MonacoThemeData {
  base: "vs" | "vs-dark";
  inherit: true;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const color = (value: unknown): value is string =>
  typeof value === "string" && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);

const validateSyntaxRule = (rule: unknown) => {
  if (
    !record(rule) ||
    (rule.scope !== undefined &&
      typeof rule.scope !== "string" &&
      !(Array.isArray(rule.scope) && rule.scope.every((scope) => typeof scope === "string")))
  )
    throw new Error("Each syntax rule must have a string scope or an array of string scopes.");
  if (
    rule.settings !== undefined &&
    (!record(rule.settings) ||
      (rule.settings.foreground !== undefined && !color(rule.settings.foreground)) ||
      (rule.settings.fontStyle !== undefined && typeof rule.settings.fontStyle !== "string"))
  )
    throw new Error("Syntax settings must use a hexadecimal foreground and a string fontStyle.");
};

/** Validate the supported inline VS Code subset before an asset enters the theme catalog. */
export const parseVsCodeColorTheme = (input: unknown) => {
  if (!record(input)) throw new Error("Theme must be a JSON object.");
  if (input.pstdio !== undefined && !record(input.pstdio))
    throw new Error("pstdio must be an object with a colors map.");
  if (input.include !== undefined)
    throw new Error("Theme include files are unsupported; inline the included colors and syntax rules.");
  if (input.tokenColors !== undefined && !Array.isArray(input.tokenColors)) {
    throw new Error("tokenColors must be an inline array; external TextMate files are unsupported.");
  }
  for (const [name, colors] of [
    ["colors", input.colors],
    ["pstdio.colors", record(input.pstdio) ? input.pstdio.colors : undefined],
  ]) {
    if (colors === undefined) continue;
    if (!record(colors) || !Object.values(colors).every(color))
      throw new Error(`${name} must map color names to hexadecimal colors.`);
  }
  for (const rule of (input.tokenColors ?? []) as unknown[]) validateSyntaxRule(rule);
  return input as VsCodeColorTheme;
};

export const inferThemeMode = (theme: VsCodeColorTheme, mode?: unknown) => {
  if (mode === "light" || mode === "dark") return mode;
  if (theme.type === "light" || theme.type === "hcLight") return "light";
  if (theme.type === "dark" || theme.type === "hc") return "dark";
  return luminance(theme.colors?.["editor.background"] ?? "#FFFFFF") > 0.179 ? "light" : "dark";
};

export const createMonacoTheme = (mode: ThemeMode, theme: VsCodeColorTheme) =>
  ({
    base: mode === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules: (theme.tokenColors ?? []).flatMap((rule) => {
      const scopes = rule.scope
        ? [rule.scope].flat().flatMap((scope) => scope.split(",").map((part) => part.trim()))
        : [];
      return scopes.map((token) => ({
        token,
        ...(rule.settings?.foreground ? { foreground: expandTokenColor(rule.settings.foreground) } : {}),
        ...(rule.settings?.fontStyle !== undefined ? { fontStyle: rule.settings.fontStyle } : {}),
      }));
    }),
    colors: theme.colors ?? {},
  }) satisfies MonacoThemeData;

const expandTokenColor = (color: string) => {
  const hex = color.replace(/^#/, "");
  return hex.length <= 4 ? [...hex].map((digit) => digit.repeat(2)).join("") : hex;
};
