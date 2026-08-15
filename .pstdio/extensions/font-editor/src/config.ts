export const FONT_EDITOR_CONFIG_PATH = ".pstdio/configs/font-editor.json";

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

export const parseFontEditorConfig = (value: string) => {
  const config = JSON.parse(value) as FontEditorConfig;

  if (config.version !== 1) throw new Error(`Unsupported font editor config version: ${config.version}`);
  if (!config.formats.every((format) => fontFormats.includes(format))) {
    throw new Error("Font formats must be eot, svg, ttf, woff, or woff2.");
  }

  return config;
};
