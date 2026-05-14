import { generateDiffFile } from "@git-diff-view/file";
import type { DiffViewProps } from "@git-diff-view/react";

const FALLBACK_OLD_PATH = "before.txt";
const FALLBACK_NEW_PATH = "after.txt";
const MAX_CACHE_ENTRIES = 100;

interface ResolveDiffLanguageInput {
  language?: string;
  oldPath?: string;
  newPath?: string;
}

interface BuildDiffViewDataInput extends ResolveDiffLanguageInput {
  original: string;
  modified: string;
}

export type DiffViewData = NonNullable<DiffViewProps<unknown>["data"]>;

/** Diff view data enriched with the exact row counts the renderer will produce. */
export interface BuiltDiffViewData extends DiffViewData {
  unifiedLineLength: number;
  splitLineLength: number;
}

const extToLanguage: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  py: "python",
  go: "go",
  rs: "rust",
  css: "css",
  html: "html",
  sh: "shell",
  yml: "yaml",
  yaml: "yaml",
};

const getExtension = (path: string) => {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const ext = fileName.split(".").pop();

  return ext?.toLowerCase();
};

export const resolveDiffLanguage = ({ language, oldPath, newPath }: ResolveDiffLanguageInput) => {
  if (language) {
    return language;
  }

  const extension = getExtension(newPath ?? oldPath ?? "");

  if (!extension) {
    return "plaintext";
  }

  return extToLanguage[extension] ?? "plaintext";
};

// Building a diff file parses both file contents and walks every rendered line. The drawer's
// virtualizer asks for heights far more often than the diff content changes, so memoize by
// content signature and share one instance with the rendered editor.
const cache = new Map<string, BuiltDiffViewData>();

const getCacheKey = ({ original, modified, language, oldPath, newPath }: BuildDiffViewDataInput) =>
  [original, modified, language ?? "", oldPath ?? "", newPath ?? ""].join("\0");

const computeDiffViewData = ({ original, modified, language, oldPath, newPath }: BuildDiffViewDataInput) => {
  const oldFileName = oldPath ?? newPath ?? FALLBACK_OLD_PATH;
  const newFileName = newPath ?? oldPath ?? FALLBACK_NEW_PATH;
  const fileLanguage = resolveDiffLanguage({ language, oldPath, newPath });

  // No uuid: @git-diff-view keys its internal File cache by uuid when one is given, so a
  // shared constant would make every diff reuse the first file's content. Omitting it keys
  // the cache by raw content, which is both correct and the caching we actually want.
  const diffFile = generateDiffFile(oldFileName, original, newFileName, modified, fileLanguage, fileLanguage, {
    context: 3,
  });

  // Raw init + line builds are idempotent and populate the exact rendered row counts.
  // Syntax highlighting is intentionally skipped here — it is not needed to count lines.
  diffFile.initRaw();
  diffFile.buildUnifiedDiffLines();
  diffFile.buildSplitDiffLines();

  return {
    oldFile: {
      fileName: oldFileName,
      fileLang: fileLanguage,
      content: original,
    },
    newFile: {
      fileName: newFileName,
      fileLang: fileLanguage,
      content: modified,
    },
    hunks: diffFile._diffList,
    unifiedLineLength: diffFile.unifiedLineLength,
    splitLineLength: diffFile.splitLineLength,
  } satisfies BuiltDiffViewData;
};

export const buildDiffViewData = (input: BuildDiffViewDataInput): BuiltDiffViewData => {
  const key = getCacheKey(input);
  const cached = cache.get(key);
  if (cached) return cached;

  const data = computeDiffViewData(input);

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, data);

  return data;
};
