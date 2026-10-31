// The contract between `pstdio-canvas` and the UI Canvas extension. Bump the format when a
// reader could misread an older or newer manifest.
export const MANIFEST_FORMAT = 1;

// The folder UI Canvas reads, relative to the project root.
export const DEFAULT_OUT = ".pstdio/extension-storage/pstdio.canvas/build";

export interface FrameManifest {
  entry: string;
  catalog: string;
  sources: Record<string, { script: string; project?: string }>;
  modules: Record<string, { file: string; imports: string[]; dynamicImports: string[]; bytes: number; css?: string[] }>;
  styles: string[];
}

export interface CanvasFrameEntry {
  exportName: string;
  name: string;
  description?: string;
  fullscreen?: boolean;
}

export interface CanvasEntry {
  /** The canvas file path relative to the project root. */
  id: string;
  title: string;
  /** The title before its last `/`; empty for a title without one. */
  group: string;
  name: string;
  description?: string;
  /** The nearest `.canvas/preview.tsx`, relative to the project root. */
  preview?: string;
  frames: CanvasFrameEntry[];
  /** Why this canvas could not be built. Its frames are not in the module graph. */
  error?: string;
}

export interface CanvasBuildManifest {
  format: typeof MANIFEST_FORMAT;
  builtAt: string;
  canvases: CanvasEntry[];
  frames: FrameManifest;
  /** Source files the build read, relative to the project root, with their modification times. */
  inputs: Record<string, number>;
}
