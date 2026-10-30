import { type CanvasFrame, type CanvasMeta, type CanvasPreview, composePreview } from "@pstdio/canvas";

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
    return { ...preview, timings: { importMs: importedAt - started, setupMs: performance.now() - importedAt } };
  };
