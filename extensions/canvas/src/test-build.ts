import type { CanvasBuildManifest } from "@pstdio/canvas";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import type { CanvasItem } from "./canvas-model";

// A build as `pstdio-canvas` writes it: three frames in one canvas, one in another, and one
// canvas that failed.
export const testManifest = (): CanvasBuildManifest => ({
  format: 1,
  builtAt: "2026-10-31T00:00:00.000Z",
  inputs: {},
  canvases: [
    {
      id: "src/foundations.canvas.tsx",
      title: "Design System/Foundations",
      group: "Design System",
      name: "Foundations",
      frames: [
        { exportName: "Colors", name: "Colors" },
        { exportName: "Typography", name: "Typography", defaultTheme: "pstdio-dark" },
        { exportName: "Spacing", name: "Spacing" },
      ],
    },
    {
      id: "src/folder-picker.canvas.tsx",
      title: "Components/Overlays/Create folder",
      group: "Components/Overlays",
      name: "Create folder",
      frames: [{ exportName: "Default", name: "Default", fullscreen: true }],
    },
    {
      id: "src/chart.canvas.tsx",
      title: "Components/Chart",
      group: "Components",
      name: "Chart",
      frames: [],
      error: 'Could not resolve "missing-chart"',
    },
  ],
  frames: {
    entry: "runtime.js",
    catalog: "runtime.js",
    sources: {
      "src/foundations.canvas.tsx": { script: "foundations.js" },
      "src/folder-picker.canvas.tsx": { script: "folder-picker.js" },
    },
    modules: {
      "runtime.js": { file: "modules/runtime.txt", imports: [], dynamicImports: [], bytes: 1 },
      "foundations.js": { file: "modules/foundations.txt", imports: [], dynamicImports: [], bytes: 1 },
      "folder-picker.js": { file: "modules/folder-picker.txt", imports: [], dynamicImports: [], bytes: 1 },
    },
    styles: [],
  },
});

export const testContext = async (manifest: CanvasBuildManifest | null = testManifest()) => {
  const files = createMemoryRepoFiles();
  if (manifest) await files.writeText("manifest.json", JSON.stringify(manifest));
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { artifacts: { mount: () => files } },
  });
  return { ctx, files };
};

export const testItems = (ids: string[], width = 400): CanvasItem[] =>
  ids.map((id, index) => ({
    id,
    name: id,
    width,
    height: 240,
    position: { x: index * (width + 80), y: 0 },
    preview: { source: "src/test.canvas.tsx", exportName: id, viewportHeight: 960, revision: "1" },
  }));
