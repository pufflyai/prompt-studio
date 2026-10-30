import { type CanvasMeta, type CanvasProject, type CanvasVariant, composePreview } from "@pstdio/canvas";
import type { ComponentType } from "react";

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
    if (input.kind === "document") {
      imported();
      return {
        Component: module.default as ComponentType,
        timings: { importMs: performance.now() - started, setupMs: 0 },
      };
    }
    const project = (await projects[input.suite]()).default;
    const exportName = input.exportName!;
    if (!module[exportName]) throw new Error(`Missing preview: ${input.source}#${exportName}`);
    const importedAt = performance.now();
    imported();
    const preview = await composePreview(
      module[exportName] as CanvasVariant,
      module.default as CanvasMeta,
      project as CanvasProject,
    );
    return { ...preview, timings: { importMs: importedAt - started, setupMs: performance.now() - importedAt } };
  };
