import type { CanvasBuildManifest, CanvasEntry } from "@pstdio/canvas";
import type { Point } from "./controller/geometry";
import { selectFrameModules } from "./frames/module-graph";

export interface FramePreview {
  /** The canvas file, relative to the project root. */
  source: string;
  exportName: string;
  viewportHeight: number;
  description?: string;
  defaultTheme?: string;
  /** Changes whenever this canvas's own modules change, so only its frames reload. */
  revision: string;
}
export interface CanvasItem {
  id: string;
  name: string;
  preview: FramePreview;
  position: Point;
  width: number;
  height: number;
}
export interface CanvasDefinition {
  id: string;
  name: string;
  /** The title before its last `/`, such as "Design System/Components". */
  group: string;
  description?: string;
  /** Why the canvas could not be built. It then has no frames. */
  error?: string;
  layout?: "grid";
  items: readonly CanvasItem[];
}

const VIEWPORT_HEIGHT = 960;
const COLUMNS = 4;
const GAP = 80;

// FNV-1a: a short, stable fingerprint that works in the extension backend and in browsers.
const fingerprint = (text: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return (hash >>> 0).toString(36);
};

const canvasRevision = (manifest: CanvasBuildManifest, id: string) => {
  // The runtime entry changes with every build, so leave it out of each canvas's revision.
  const runtime = new Set(selectFrameModules(manifest.frames, "$runtime"));
  const own = selectFrameModules(manifest.frames, id).filter((name) => !runtime.has(name));
  return fingerprint(own.sort().join("\n"));
};

export const toCanvas = (manifest: CanvasBuildManifest, entry: CanvasEntry): CanvasDefinition => {
  const revision = entry.error ? "" : canvasRevision(manifest, entry.id);
  const sized = entry.frames.map((frame) => ({ frame, width: frame.fullscreen ? 1200 : 640 }));
  const column = Math.max(0, ...sized.map((item) => item.width)) + GAP;
  return {
    id: entry.id,
    name: entry.name,
    group: entry.group,
    description: entry.description,
    error: entry.error,
    layout: "grid",
    items: entry.error
      ? []
      : sized.map(({ frame, width }, index) => ({
          id: frame.exportName,
          name: frame.name,
          position: { x: (index % COLUMNS) * column, y: Math.floor(index / COLUMNS) * (VIEWPORT_HEIGHT + GAP + 60) },
          width,
          height: frame.fullscreen ? VIEWPORT_HEIGHT : 240,
          preview: {
            source: entry.id,
            exportName: frame.exportName,
            viewportHeight: VIEWPORT_HEIGHT,
            description: frame.description,
            defaultTheme: frame.defaultTheme,
            revision,
          },
        })),
  };
};

export const findCanvas = (manifest: CanvasBuildManifest, id: string) => {
  const entry = manifest.canvases.find((canvas) => canvas.id === id);
  return entry && toCanvas(manifest, entry);
};
