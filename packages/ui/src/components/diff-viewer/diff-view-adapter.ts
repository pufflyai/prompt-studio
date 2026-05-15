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

/**
 * Diff view data enriched with the row counts the renderer will actually paint. The renderer
 * collapses unchanged context, so only lines inside the hunks are rendered — these counts come
 * from the hunk patch, not the full file length.
 */
export interface BuiltDiffViewData extends DiffViewData {
  /** Content rows painted in unified layout (one per added/removed/context line). */
  unifiedContentRows: number;
  /** Content rows painted in split layout (paired add/remove lines share a row). */
  splitContentRows: number;
  /** Hunk header rows — one per `@@` section, taller than content rows. */
  hunkRows: number;
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

// The hunk patch lists exactly the rows the renderer paints (it collapses everything else).
// Walk it once: `@@` starts a hunk header row, ` ` is a context row, and a run of `-`/`+`
// is one change block — unified stacks every line, split pairs them so the block is as tall
// as its longer side.
const countRenderedRows = (hunks: string[]) => {
  const lines = hunks.join("\n").split("\n");
  let unifiedContentRows = 0;
  let splitContentRows = 0;
  let hunkRows = 0;
  let inHunk = false;
  let blockAdditions = 0;
  let blockDeletions = 0;

  const flushBlock = () => {
    unifiedContentRows += blockAdditions + blockDeletions;
    splitContentRows += Math.max(blockAdditions, blockDeletions);
    blockAdditions = 0;
    blockDeletions = 0;
  };

  for (const line of lines) {
    if (line.startsWith("@@")) {
      flushBlock();
      hunkRows += 1;
      inHunk = true;
    } else if (!inHunk) {
      // Patch header (Index:, ===, ---, +++) before the first hunk — not rendered.
    } else if (line.startsWith("+")) {
      blockAdditions += 1;
    } else if (line.startsWith("-")) {
      blockDeletions += 1;
    } else if (line.startsWith(" ")) {
      flushBlock();
      unifiedContentRows += 1;
      splitContentRows += 1;
    }
  }
  flushBlock();

  return { unifiedContentRows, splitContentRows, hunkRows };
};

const computeDiffViewData = ({ original, modified, language, oldPath, newPath }: BuildDiffViewDataInput) => {
  const oldFileName = oldPath ?? newPath ?? FALLBACK_OLD_PATH;
  const newFileName = newPath ?? oldPath ?? FALLBACK_NEW_PATH;
  const fileLanguage = resolveDiffLanguage({ language, oldPath, newPath });

  // No uuid: @git-diff-view keys its internal File cache by uuid when one is given, so a
  // shared constant would make every diff reuse the first file's content. Omitting it keys
  // the cache by raw content, which is correct.
  const diffFile = generateDiffFile(oldFileName, original, newFileName, modified, fileLanguage, fileLanguage, {
    context: 3,
  });

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
    ...countRenderedRows(diffFile._diffList),
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
