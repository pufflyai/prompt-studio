import type { FileRendererContent } from "../../../core";
import { type FileEditController, nextLoadedRevision } from "./file-renderer-edit-state";

export interface LoadedFile extends FileRendererContent {
  editorRevision: number;
  loadKey: string;
}

export const prepareFileRendererLoad = (
  next: FileRendererContent,
  loadKey: string,
  controller: FileEditController | null,
) => {
  // Capture what the editor shows before accepting the load advances the baseline.
  // A completed local save has already advanced it, so its reload keeps the editor mounted.
  const editorValue = controller?.getBaseline();
  if (controller && !controller.acceptLoaded(next.content, next.revision)) return;
  return (previous: LoadedFile | null) => ({
    ...next,
    editorRevision: nextLoadedRevision(previous, next, loadKey, editorValue),
    loadKey,
  });
};
