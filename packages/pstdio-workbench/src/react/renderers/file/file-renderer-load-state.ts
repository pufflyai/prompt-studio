// Owns what a load does to the renderer: the last document per binding, the
// revision that drives the editor's React key, and the single place where a
// fetched document is accepted.

import type { QueryScope, ScopedQueryClient } from "@pstdio/sdk/extensions";
import type {
  FileRendererContent,
  FileRendererRefreshOrigin,
  RegisteredFileRendererContribution,
  ResourceRef,
} from "../../../core";
import { copyFileStorageVersions } from "../../../extensions/contributions/file-storage-versions";
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
type FileScope = Partial<QueryScope>;

export const matchesFileScope = (scope: FileScope, retired: FileScope) =>
  Object.entries(retired).every(([key, value]) => scope[key as keyof QueryScope] === value);

export const createFileContentCache = () => {
  const files = new Map<string, { content: FileRendererContent; scope: FileScope }>();
  return {
    read: (loadKey: string) => files.get(loadKey)?.content,
    store(loadKey: string, content: FileRendererContent, scope: FileScope = {}) {
      files.delete(loadKey);
      files.set(loadKey, { content, scope });
      if (files.size > FILE_CONTENT_CACHE_LIMIT) files.delete(files.keys().next().value!);
    },
    clearResource(resourceKey: string) {
      for (const key of files.keys()) {
        if (key.startsWith(`${JSON.stringify(resourceKey)}:`)) files.delete(key);
      }
    },
    retire(retired: FileScope) {
      for (const [key, entry] of files) {
        if (matchesFileScope(entry.scope, retired)) files.delete(key);
      }
    },
  };
};

const fileCaches = new WeakMap<ScopedQueryClient, ReturnType<typeof createFileContentCache>>();

export const getFileContentCache = (queries: ScopedQueryClient) => {
  let cache = fileCaches.get(queries);
  if (!cache) {
    cache = createFileContentCache();
    fileCaches.set(queries, cache);
    queries.subscribeScopeRetirement(cache.retire);
  }
  return cache;
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

// The controller takes the document as its baseline and reports what the editor
// was showing. The returned updater puts it in React state. Returns nothing when the controller
// rejects the load, which it does while local edits or a failed save wait.
export const acceptFileRendererLoad = (
  next: FileRendererContent,
  loadKey: string,
  controller: FileEditController | null,
) => {
  const accepted = controller ? controller.acceptLoaded(next.content, next.revision) : { shown: undefined };
  if (!accepted) return;
  return (previous: LoadedFile | null) => ({
    ...next,
    editorRevision: nextLoadedRevision(previous, next, loadKey, accepted.shown),
    loadKey,
  });
};

export const saveLoadedFile = async (
  contribution: RegisteredFileRendererContribution,
  resource: ResourceRef | undefined,
  value: string,
  origin: FileRendererRefreshOrigin,
  loaded: FileRendererContent | undefined,
  signal?: AbortSignal,
) => {
  const result = await contribution.save?.(resource, value, origin, loaded, signal);
  const content = loaded ? copyFileStorageVersions({ ...loaded, content: value }, result) : undefined;
  return { result: result ?? undefined, content };
};
