export const FONT_EDITOR_CONFIG_PATH = ".pstdio/font-editor/config.json";

export const fontFormats = ["eot", "svg", "ttf", "woff", "woff2"] as const;

export interface FontEditorConfig {
  version: 1;
  source: string;
  outputDir: string;
  cssFile: string;
  family: string;
  fileName: string;
  cssPrefix: string;
  fontsUrl: string;
  formats: (typeof fontFormats)[number][];
  startCodepoint: string;
  endCodepoint: string;
  cacheBust: "content-hash";
}

export const defaultFontEditorConfig: FontEditorConfig = {
  version: 1,
  source: "packages/ui/public/font/prompt-studio-icons.ttf",
  outputDir: "packages/ui/public/font",
  cssFile: "css/prompt-studio-icons.css",
  family: "prompt-studio-icons",
  fileName: "prompt-studio-icons",
  cssPrefix: "icon-",
  fontsUrl: "$fonts",
  formats: [...fontFormats],
  startCodepoint: "U+E800",
  endCodepoint: "U+F8FF",
  cacheBust: "content-hash",
};

export const parseFontEditorConfig = (value: string) => {
  const parsed = JSON.parse(value) as Partial<FontEditorConfig>;
  const config = { ...defaultFontEditorConfig, ...parsed };

  if (config.version !== 1) throw new Error(`Unsupported font editor config version: ${config.version}`);
  if (!config.formats.every((format) => fontFormats.includes(format))) {
    throw new Error("Font formats must be eot, svg, ttf, woff, or woff2.");
  }

  return config;
};
