export interface FileIconThemeFont {
  fontFamily: string;
  src: { url: string; format?: string }[];
  weight?: string;
  style?: string;
}

export interface FileIconThemeDefinition {
  fontCharacter?: string;
  fontColor?: string;
  fontId?: string;
}

export interface FileIconThemePreferenceOption {
  id: string;
  title?: string;
  definitions: Record<string, unknown>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  defaults: { file?: string; folder?: string };
  fonts: FileIconThemeFont[];
}

export const defaultFileIconThemePreferences: FileIconThemePreferenceOption[] = [];

export const isFileIconThemePreference = (
  value: string | null,
  themes: readonly FileIconThemePreferenceOption[],
): value is string => typeof value === "string" && themes.some((theme) => theme.id === value);

// VS Code matches the longest compound extension first ("d.ts" before "ts").
const extensionCandidates = (filename: string) => {
  const parts = filename.toLowerCase().split(".");
  const candidates: string[] = [];
  for (let i = 1; i < parts.length; i += 1) candidates.push(parts.slice(i).join("."));
  return candidates;
};

const resolveDefinitionKey = (theme: FileIconThemePreferenceOption, filename: string, isDirectory: boolean) => {
  if (isDirectory) return theme.defaults.folder;

  const named = theme.fileNames[filename.toLowerCase()];
  if (named) return named;

  for (const candidate of extensionCandidates(filename)) {
    const match = theme.fileExtensions[candidate];
    if (match) return match;
  }

  return theme.defaults.file;
};

const fontFamilyForDefinition = (theme: FileIconThemePreferenceOption, definition: FileIconThemeDefinition) => {
  if (definition.fontId) {
    const matched = theme.fonts.find((font) => font.fontFamily === `${theme.id}-${definition.fontId}`);
    if (matched) return matched.fontFamily;
  }
  return theme.fonts[0]?.fontFamily;
};

export interface ResolvedFileIconGlyph {
  fontFamily: string;
  fontCharacter: string;
  fontColor?: string;
}

// VS Code icon themes store the glyph as a CSS escape ("\\E023"); decode it to the real code point.
const decodeFontCharacter = (value: string) => {
  const match = /^\\([0-9a-fA-F]+)$/.exec(value);
  return match ? String.fromCodePoint(Number.parseInt(match[1], 16)) : value;
};

export const resolveFileIconGlyph = (
  theme: FileIconThemePreferenceOption | undefined,
  filename: string,
  isDirectory = false,
): ResolvedFileIconGlyph | undefined => {
  if (!theme) return undefined;

  const key = resolveDefinitionKey(theme, filename, isDirectory);
  if (!key) return undefined;

  const definition = theme.definitions[key] as FileIconThemeDefinition | undefined;
  if (!definition?.fontCharacter) return undefined;

  const fontFamily = fontFamilyForDefinition(theme, definition);
  if (!fontFamily) return undefined;

  return {
    fontFamily,
    fontCharacter: decodeFontCharacter(definition.fontCharacter),
    fontColor: definition.fontColor,
  };
};

const FONT_STYLE_ATTRIBUTE = "data-pstdio-file-icon-fonts";

const fontFaceRule = (font: FileIconThemeFont) => {
  const src = font.src
    .map((entry) => `url("${entry.url}")${entry.format ? ` format("${entry.format}")` : ""}`)
    .join(", ");
  return [
    "@font-face {",
    `  font-family: "${font.fontFamily}";`,
    `  src: ${src};`,
    `  font-weight: ${font.weight ?? "normal"};`,
    `  font-style: ${font.style ?? "normal"};`,
    "}",
  ].join("\n");
};

export const applyFileIconThemePreference = (
  themeId: string | null,
  themes: readonly FileIconThemePreferenceOption[],
) => {
  if (typeof document === "undefined") return;

  let style = document.querySelector<HTMLStyleElement>(`style[${FONT_STYLE_ATTRIBUTE}]`);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute(FONT_STYLE_ATTRIBUTE, "");
    document.head.appendChild(style);
  }

  const theme = themes.find((option) => option.id === themeId);
  style.textContent = (theme?.fonts ?? []).map(fontFaceRule).join("\n\n");
};
