import { colors } from "@/theme/primitives/colors";
import { fontSizes, fonts, fontWeights } from "@/theme/primitives/fonts";
import { radii, spacing } from "@/theme/primitives/sizes";
import { borders } from "@/theme/tokens/borders";
import { semanticColors } from "@/theme/tokens/colors";

export type TokenEditorPresetId = "pst-dark" | "pst-light" | "monokai" | "solarized";
export type TokenEditorMode = "light" | "dark";
export type TokenEditorTokenKind = "border" | "color" | "dimension" | "font" | "number";
export type TokenEditorValues = Record<string, string>;

export interface TokenEditorToken {
  id: string;
  cssVariable: string;
  defaultValue: string;
  darkValue: string;
  groupId: string;
  kind: TokenEditorTokenKind;
  lightValue: string;
  name: string;
}

export interface TokenEditorGroup {
  id: string;
  title: string;
  description: string;
  tokens: TokenEditorToken[];
}

export interface TokenEditorPreset {
  id: TokenEditorPresetId;
  label: string;
  values: TokenEditorValues;
}

interface TokenSource {
  cssNamespace: string;
  description: string;
  id: string;
  kind: TokenEditorTokenKind;
  prefix: string;
  title: string;
  tokens: Record<string, unknown>;
}

interface RawToken {
  id: string;
  name: string;
  rawValue: unknown;
}

const tokenSources: TokenSource[] = [
  {
    id: "semantic-colors",
    title: "Semantic colors",
    description: "Application color roles consumed by recipes and components.",
    prefix: "colors",
    cssNamespace: "colors",
    kind: "color",
    tokens: semanticColors as Record<string, unknown>,
  },
  {
    id: "primitive-colors",
    title: "Primitive colors",
    description: "Raw palette stops that semantic colors resolve to.",
    prefix: "colors",
    cssNamespace: "colors",
    kind: "color",
    tokens: colors as Record<string, unknown>,
  },
  {
    id: "spacing",
    title: "Spacing",
    description: "Layout gaps and component padding.",
    prefix: "spacing",
    cssNamespace: "spacing",
    kind: "dimension",
    tokens: spacing as Record<string, unknown>,
  },
  {
    id: "radii",
    title: "Radii",
    description: "Corner radius tokens. Default app controls should stay at xs.",
    prefix: "radii",
    cssNamespace: "radii",
    kind: "dimension",
    tokens: radii as Record<string, unknown>,
  },
  {
    id: "fonts",
    title: "Fonts",
    description: "Font-family aliases used by text styles.",
    prefix: "fonts",
    cssNamespace: "fonts",
    kind: "font",
    tokens: fonts as Record<string, unknown>,
  },
  {
    id: "font-sizes",
    title: "Font sizes",
    description: "Type scale values referenced by text styles.",
    prefix: "fontSizes",
    cssNamespace: "font-sizes",
    kind: "dimension",
    tokens: fontSizes as Record<string, unknown>,
  },
  {
    id: "font-weights",
    title: "Font weights",
    description: "Weight aliases used by text styles and controls.",
    prefix: "fontWeights",
    cssNamespace: "font-weights",
    kind: "number",
    tokens: fontWeights as Record<string, unknown>,
  },
  {
    id: "borders",
    title: "Borders",
    description: "Border shorthand tokens used by outlines and separators.",
    prefix: "borders",
    cssNamespace: "borders",
    kind: "border",
    tokens: borders as Record<string, unknown>,
  },
];

const referencePattern = /\{([^}]+)\}/g;
const rawValues = new Map<string, unknown>();

const isRecord = (value: unknown) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const tokenPath = (parts: string[]) => parts.filter((part) => part !== "DEFAULT").join(".");

const tokenName = (parts: string[]) => {
  const name = parts.at(-1) ?? "";
  if (name === "DEFAULT") return parts.at(-2) ?? name;
  return name;
};

const cssVariableName = (source: TokenSource, id: string) => {
  const [, ...suffixParts] = id.split(".");
  const suffix = suffixParts.join("-");
  if (!suffix) return `--chakra-${source.cssNamespace}`;
  return `--chakra-${source.cssNamespace}-${suffix}`;
};

const flattenRawTokens = (source: Record<string, unknown>, parts: string[]) => {
  const tokens: RawToken[] = [];

  for (const [key, entry] of Object.entries(source)) {
    const nextParts = [...parts, key];
    const entryRecord = isRecord(entry) ? (entry as Record<string, unknown>) : undefined;

    if (entryRecord && "value" in entryRecord) {
      tokens.push({
        id: tokenPath(nextParts),
        name: tokenName(nextParts),
        rawValue: entryRecord.value,
      });
      continue;
    }

    if (entryRecord) {
      tokens.push(...flattenRawTokens(entryRecord, nextParts));
    }
  }

  return tokens;
};

for (const source of tokenSources) {
  for (const token of flattenRawTokens(source.tokens, [source.prefix])) {
    rawValues.set(token.id, token.rawValue);
  }
}

const rawValueForMode = (value: unknown, mode: TokenEditorMode) => {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;

  if (isRecord(value)) {
    const modeValue = (value as Record<string, unknown>)[mode === "dark" ? "_dark" : "_light"];
    if (modeValue !== undefined) return rawValueForMode(modeValue, mode);
  }

  return String(value ?? "");
};

const resolveRawValue = (value: unknown, mode: TokenEditorMode, seen: Set<string>) => {
  let resolved = rawValueForMode(value, mode);

  for (let pass = 0; pass < 8 && resolved.includes("{"); pass += 1) {
    const nextResolved = resolved.replace(referencePattern, (_, id: string) => {
      if (seen.has(id)) return id;

      const rawValue = rawValues.get(id);
      if (rawValue === undefined) return id;

      seen.add(id);
      const tokenValue = rawValueForMode(rawValue, mode);
      seen.delete(id);
      return tokenValue;
    });

    if (nextResolved === resolved) break;
    resolved = nextResolved;
  }

  return resolved;
};

const createToken = (source: TokenSource, token: RawToken) => {
  const lightValue = resolveRawValue(token.rawValue, "light", new Set());
  const darkValue = resolveRawValue(token.rawValue, "dark", new Set());

  return {
    id: token.id,
    name: token.name,
    cssVariable: cssVariableName(source, token.id),
    defaultValue: lightValue,
    lightValue,
    darkValue,
    kind: source.kind,
    groupId: source.id,
  };
};

export const tokenEditorGroups: TokenEditorGroup[] = tokenSources.map((source) => ({
  id: source.id,
  title: source.title,
  description: source.description,
  tokens: flattenRawTokens(source.tokens, [source.prefix]).map((token) => createToken(source, token)),
}));

export const tokenEditorTokens = tokenEditorGroups.flatMap((group) => group.tokens);

const buildModeValues = (mode: TokenEditorMode) => {
  const valueKey = mode === "dark" ? "darkValue" : "lightValue";
  return Object.fromEntries(tokenEditorTokens.map((token) => [token.id, token[valueKey]]));
};

const withOverrides = (baseValues: TokenEditorValues, overrides: TokenEditorValues) => ({
  ...baseValues,
  ...overrides,
});

export const pstLightTokenEditorValues = buildModeValues("light");
export const pstDarkTokenEditorValues = buildModeValues("dark");

export const tokenEditorPresets: TokenEditorPreset[] = [
  {
    id: "pst-dark",
    label: "pst-dark",
    values: pstDarkTokenEditorValues,
  },
  {
    id: "pst-light",
    label: "pst-light",
    values: pstLightTokenEditorValues,
  },
  {
    id: "monokai",
    label: "monokai",
    values: withOverrides(pstDarkTokenEditorValues, {
      "colors.bg": "#272822",
      "colors.bg.active": "#3e3d32",
      "colors.bg.hover": "#3a3a31",
      "colors.bg.muted": "#34352f",
      "colors.bg.subtle": "#1f201b",
      "colors.border": "#75715e",
      "colors.border.accent": "#66d9ef",
      "colors.border.accent-light": "#a1efe4",
      "colors.border.subtle": "#49483e",
      "colors.fg": "#f8f8f2",
      "colors.fg.error": "#f92672",
      "colors.fg.muted": "#cfcfc2",
      "colors.fg.subtle": "#a6a697",
      "colors.fg.success": "#a6e22e",
      "colors.bg.accent-primary.default": "#e6db74",
      "colors.bg.accent-primary.hover": "#f4e985",
      "colors.bg.accent-primary.pressed": "#d6ca62",
      "colors.bg.accent-primary.light": "#3a3724",
      "colors.bg.accent-primary.medium": "#665f2d",
      "colors.bg.accent-primary.dark": "#e6db74",
      "colors.bg.error": "#4a1828",
      "colors.bg.success": "#26351d",
    }),
  },
  {
    id: "solarized",
    label: "solarized",
    values: withOverrides(pstLightTokenEditorValues, {
      "colors.bg": "#fdf6e3",
      "colors.bg.active": "#eee8d5",
      "colors.bg.hover": "#eee8d5",
      "colors.bg.muted": "#f3ecd8",
      "colors.bg.subtle": "#fff8e8",
      "colors.border": "#93a1a1",
      "colors.border.accent": "#268bd2",
      "colors.border.accent-light": "#7fc3ea",
      "colors.border.subtle": "#d9d2bd",
      "colors.fg": "#073642",
      "colors.fg.error": "#dc322f",
      "colors.fg.muted": "#586e75",
      "colors.fg.subtle": "#839496",
      "colors.fg.success": "#859900",
      "colors.bg.accent-primary.default": "#b58900",
      "colors.bg.accent-primary.hover": "#caa21f",
      "colors.bg.accent-primary.pressed": "#a77900",
      "colors.bg.accent-primary.light": "#f5e8b9",
      "colors.bg.accent-primary.medium": "#ead899",
      "colors.bg.accent-primary.dark": "#b58900",
      "colors.bg.error": "#f5d6d4",
      "colors.bg.success": "#e6edc3",
    }),
  },
];

export const defaultTokenEditorValues = pstLightTokenEditorValues;

export const createTokenEditorStyle = (values: TokenEditorValues) =>
  Object.fromEntries(tokenEditorTokens.map((token) => [token.cssVariable, values[token.id] ?? token.defaultValue]));
