export interface GlyphView {
  name: string;
  codepoint: string;
  unicode: number;
  advanceWidth: number;
}

export interface FontInspectionView {
  family: string;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  glyphs: GlyphView[];
}

export interface FontPreviewView {
  family: string;
  fontDataUrl: string;
}

export interface FontConfigView {
  version: 1;
  source: string;
  outputDir: string;
  cssFile: string;
  family: string;
  fileName: string;
  cssPrefix: string;
  fontsUrl: string;
  formats: string[];
  startCodepoint: string;
  endCodepoint: string;
  cacheBust: "content-hash";
}

export interface FontOperationView {
  glyphCount: number;
  formats: string[];
  glyph?: GlyphView;
}
