import {
  type CanvasFrame,
  type CanvasMeta,
  type CanvasPreview,
  CanvasThemeContext,
  composePreview,
} from "@pstdio/canvas";

interface PreviewInput {
  kind: string;
  suite: string;
  source: string;
  exportName?: string;
}

export const createPreviewLoader =
  (
    modules: Record<string, () => Promise<Record<string, unknown>>>,
    projects: Record<string, () => Promise<{ default: Record<string, unknown> }>>,
  ) =>
  async (input: PreviewInput, imported: () => void) => {
    const started = performance.now();
    const module = await modules[input.source]?.();
    if (!module) throw new Error(`Missing preview source: ${input.source}`);
    const project = (await projects[input.suite]()).default;
    const exportName = input.exportName!;
    if (!module[exportName]) throw new Error(`Missing preview: ${input.source}#${exportName}`);
    const importedAt = performance.now();
    imported();
    const preview = composePreview(
      module[exportName] as CanvasFrame,
      module.default as CanvasMeta,
      project as CanvasPreview,
    );
    // A preview with decorators themes its frames from this context; the runtime themes the others.
    return {
      ...preview,
      ThemeProvider: (project as CanvasPreview).decorators?.length ? CanvasThemeContext.Provider : undefined,
      timings: { importMs: importedAt - started, setupMs: performance.now() - importedAt },
    };
  };
