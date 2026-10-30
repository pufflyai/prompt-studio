import { type CanvasMeta, type CanvasProject, type CanvasVariant, composePreview } from "@pstdio/canvas";
import type { ComponentType } from "react";

declare const __UI_CANVAS_MODULES__: Record<string, () => Promise<Record<string, unknown>>>;
declare const __UI_CANVAS_PROJECTS__: Record<string, () => Promise<{ default: Record<string, unknown> }>>;

interface PreviewInput {
  kind: string;
  suite: string;
  source: string;
  exportName?: string;
}

export const loadPreview = async (input: PreviewInput) => {
  const module = await __UI_CANVAS_MODULES__[input.source]?.();
  if (!module) throw new Error(`Missing preview source: ${input.source}`);
  if (input.kind === "document") return { Component: module.default as ComponentType };
  const project = (await __UI_CANVAS_PROJECTS__[input.suite]()).default;
  const exportName = input.exportName!;
  if (!module[exportName]) throw new Error(`Missing preview: ${input.source}#${exportName}`);
  return composePreview(module[exportName] as CanvasVariant, module.default as CanvasMeta, project as CanvasProject);
};
