import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { JsonObject } from "./json";

export interface FileRendererResourceRef {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: JsonObject;
}

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
  projectId?: string;
  resource?: FileRendererResourceRef;
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
  projectId?: string;
  resource?: FileRendererResourceRef;
  content: string;
}

export interface FileRendererContribution {
  title: Localizable<string>;
  icon?: string;
  resourceKind?: string;
  loadCommand: CommandRef<FileRendererLoadParams, FileRendererLoadResult> | string;
  // Omit to make the renderer read-only. Images are always read-only regardless.
  saveCommand?: CommandRef<FileRendererSaveParams, unknown> | string;
}
