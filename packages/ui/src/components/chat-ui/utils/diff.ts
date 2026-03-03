import type { TitleSegment } from "../components/timeline";

export type FileChange = { filePath: string; additions: number; deletions: number };

export function basenameSafe(path: string) {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function normalizeHeaderPath(input?: string | null) {
  if (!input) return null;

  const token = input.split("\t")[0].trim();
  if (token === "/dev/null") return null;

  let normalized = token;
  if (normalized.startsWith("a/") || normalized.startsWith("b/")) {
    normalized = normalized.slice(2);
  }

  return normalized.replace(/^\/+/, "").replace(/\\/g, "/");
}

const isMinusHeader = (line: string) => line.startsWith("--- ");
const isPlusHeader = (line: string) => line.startsWith("+++ ");
const isHunkHeader = (line: string) => line.startsWith("@@");
const isAddedLine = (line: string) => line.startsWith("+") && !(isPlusHeader(line) || line === "+++");
const isDeletedLine = (line: string) => line.startsWith("-") && !(isMinusHeader(line) || line === "---");

const ensureFileChange = (changes: Map<string, { additions: number; deletions: number }>, filePath: string) => {
  if (!changes.has(filePath)) {
    changes.set(filePath, { additions: 0, deletions: 0 });
  }
};

const incrementAdditions = (changes: Map<string, { additions: number; deletions: number }>, filePath: string) => {
  const current = changes.get(filePath);
  if (!current) return;
  current.additions += 1;
};

const incrementDeletions = (changes: Map<string, { additions: number; deletions: number }>, filePath: string) => {
  const current = changes.get(filePath);
  if (!current) return;
  current.deletions += 1;
};

type UnifiedDiffState = {
  currentPath: string | null;
  lastMinusHeader: string | null;
  inHunk: boolean;
};

const processUnifiedDiffLine = (
  line: string,
  state: UnifiedDiffState,
  changes: Map<string, { additions: number; deletions: number }>,
) => {
  if (isMinusHeader(line)) {
    return { ...state, lastMinusHeader: normalizeHeaderPath(line.slice(4)), inHunk: false };
  }

  if (isPlusHeader(line)) {
    const plusPath = normalizeHeaderPath(line.slice(4));
    const currentPath = plusPath ?? state.lastMinusHeader;
    if (currentPath) ensureFileChange(changes, currentPath);
    return { ...state, currentPath, inHunk: false };
  }

  if (!state.currentPath) return state;

  if (isHunkHeader(line)) {
    return { ...state, inHunk: true };
  }

  if (!state.inHunk) return state;

  if (isAddedLine(line)) {
    incrementAdditions(changes, state.currentPath);
    return state;
  }

  if (isDeletedLine(line)) {
    incrementDeletions(changes, state.currentPath);
  }

  return state;
};

export function parseUnifiedDiff(diffText?: string) {
  if (!diffText || typeof diffText !== "string") return [] as FileChange[];

  const changes = new Map<string, { additions: number; deletions: number }>();
  let state: UnifiedDiffState = {
    currentPath: null,
    lastMinusHeader: null,
    inHunk: false,
  };

  const lines = diffText.split(/\r?\n/);
  for (const line of lines) {
    state = processUnifiedDiffLine(line, state, changes);
  }

  return Array.from(changes.entries()).map(([filePath, { additions, deletions }]) => ({
    filePath,
    additions,
    deletions,
  }));
}

export function buildDiffTitleSegments(diffText?: string) {
  return parseUnifiedDiff(diffText).map(
    (file) =>
      ({
        kind: "diff",
        fileName: basenameSafe(file.filePath),
        filePath: file.filePath,
        additions: file.additions,
        deletions: file.deletions,
      }) satisfies TitleSegment,
  );
}

export function extractDiffFilePaths(diffText?: string) {
  return parseUnifiedDiff(diffText).map((file) => file.filePath);
}

export type FileDiffPreview = { filePath: string; original: string; modified: string };

const isDiffFileBoundary = (line: string) => isMinusHeader(line) || line.startsWith("diff --git ");

const isInvalidHunkBodyLine = (line: string) => {
  if (line.startsWith(" ")) return false;
  if (line.startsWith("+")) return false;
  if (line.startsWith("-")) return false;
  return line.trim() !== "";
};

const appendHunkLine = (line: string, original: string[], modified: string[]) => {
  if (line.startsWith(" ")) {
    const text = line.slice(1);
    original.push(text);
    modified.push(text);
    return;
  }

  if (line.startsWith("-")) {
    original.push(line.slice(1));
    return;
  }

  if (line.startsWith("+")) {
    modified.push(line.slice(1));
  }
};

const parseHunkBody = (lines: string[], startIndex: number, original: string[], modified: string[]) => {
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] || "";
    if (isDiffFileBoundary(line) || isHunkHeader(line) || isInvalidHunkBodyLine(line)) {
      break;
    }

    appendHunkLine(line, original, modified);
    index += 1;
  }

  if (original.length > 0 || modified.length > 0) {
    original.push("");
    modified.push("");
  }

  return index;
};

const parsePreview = (lines: string[], startIndex: number) => {
  const oldHeader = normalizeHeaderPath((lines[startIndex] || "").slice(4));
  const next = lines[startIndex + 1] || "";
  if (!isPlusHeader(next)) return { nextIndex: startIndex + 1 } as const;

  const newHeader = normalizeHeaderPath(next.slice(4));
  const filePath = newHeader ?? oldHeader ?? "";
  const original: string[] = [];
  const modified: string[] = [];

  let index = startIndex + 2;
  while (index < lines.length) {
    const current = lines[index] || "";
    if (isDiffFileBoundary(current)) break;

    if (!isHunkHeader(current)) {
      index += 1;
      continue;
    }

    index = parseHunkBody(lines, index + 1, original, modified);
  }

  return {
    nextIndex: index,
    preview: { filePath, original: original.join("\n"), modified: modified.join("\n") } satisfies FileDiffPreview,
  } as const;
};

export function buildFileDiffPreviews(diffText?: string) {
  if (!diffText || typeof diffText !== "string") return [] as FileDiffPreview[];

  const lines = diffText.split(/\r?\n/);
  const previews: FileDiffPreview[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] || "";
    if (!isMinusHeader(line)) {
      i += 1;
      continue;
    }

    const { nextIndex, preview } = parsePreview(lines, i);
    if (preview) previews.push(preview);
    i = Math.max(nextIndex, i + 1);
  }

  return previews;
}
