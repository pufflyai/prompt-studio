import type { Localizable } from "../l10n";
import type { RendererCallback } from "./context";
import type { RendererContext, ResourceRef } from "./resources";

export type FileRendererResourceRef = ResourceRef;

export interface FileRendererSectionAnchor {
  /** Stable extension-owned tree node id. */
  id: string;
  /** Plain heading text as it appears in the Markdown document. */
  heading: string;
  /** Zero-based occurrence when the document repeats the same heading text. */
  occurrence?: number;
}

export interface FileRendererSectionTarget {
  /** The document outline used for deep-linking and active-heading sync. */
  anchors: FileRendererSectionAnchor[];
}

export interface FileRendererLoadParams {
  renderer: RendererContext;
}

// The host dispatches to a markdown editor, a code editor, or an image preview
// based on `fileName` / `mimeType`. Text-ish files return `content`; images
// return a `dataUrl`. An absent `fileName` falls back to the markdown editor.
export interface FileRendererLoadResult {
  fileName?: string;
  mimeType?: string;
  content?: string;
  dataUrl?: string;
  // Shown by the editor when the content is empty (editable text only).
  placeholder?: string;
}

export interface FileRendererSaveParams {
  renderer: RendererContext;
  content: string;
}

export interface FileRendererContribution {
  title: Localizable<string>;
  icon?: string;
  resourceKind?: string;
  load: RendererCallback<FileRendererLoadParams, FileRendererLoadResult>;
  // Omit to make the renderer read-only. Images are always read-only regardless.
  save?: RendererCallback<FileRendererSaveParams, unknown>;
}
