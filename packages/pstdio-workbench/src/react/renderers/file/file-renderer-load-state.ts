// Owns what a load does to the renderer: the last document per binding, the
// revision that drives the editor's React key, and the single place where a
// fetched document is accepted.

import type { FileRendererContent } from "../../../core";
import type { FileEditController } from "./file-renderer-edit-state";

export interface LoadedFile extends FileRendererContent {
  // Bumped whenever a load brings content the editor is not showing, so the
  // uncontrolled editors remount with it.
  editorRevision: number;
  loadKey: string;
}

// Last loaded document per binding, so reopening a recently viewed file mounts
// the editor immediately instead of a spinner. The follow-up load reconciles:
// unchanged content keeps the revision (no remount), changed content remounts.
const FILE_CONTENT_CACHE_LIMIT = 30;
const fileContentCache = new Map<string, FileRendererContent>();

export const readCachedFileContent = (loadKey: string) => fileContentCache.get(loadKey);

export const storeCachedFileContent = (loadKey: string, content: FileRendererContent) => {
  fileContentCache.delete(loadKey);
  fileContentCache.set(loadKey, content);
  if (fileContentCache.size <= FILE_CONTENT_CACHE_LIMIT) return;
  const oldest = fileContentCache.keys().next().value;
  if (oldest !== undefined) fileContentCache.delete(oldest);
};

// A reload that returns what the editor already shows must not remount it: the
// revision feeds the editor's React key, and a new key destroys focus and
// selection. `shown` is what the editor displayed before this load — after a
// save that is the saved value, which differs from the previously loaded state.
const nextLoadedRevision = (
  previous: LoadedFile | null,
  next: FileRendererContent,
  loadKey: string,
  shown?: string,
) => {
  if (!previous || previous.loadKey !== loadKey) return 1;
  const shownContent = shown ?? previous.content;
  if (shownContent === next.content && previous.dataUrl === next.dataUrl) return previous.editorRevision;
  return previous.editorRevision + 1;
};

// Records a load: the controller takes the document as its baseline and reports
// what the editor was showing, the cache keeps it for the next open, and the
// returned updater puts it in React state. Returns nothing when the controller
// rejects the load, which it does while local edits or a failed save wait.
export const acceptFileRendererLoad = (
  next: FileRendererContent,
  loadKey: string,
  controller: FileEditController | null,
) => {
  const accepted = controller ? controller.acceptLoaded(next.content, next.revision) : { shown: undefined };
  if (!accepted) return;
  storeCachedFileContent(loadKey, next);
  return (previous: LoadedFile | null) => ({
    ...next,
    editorRevision: nextLoadedRevision(previous, next, loadKey, accepted.shown),
    loadKey,
  });
};
