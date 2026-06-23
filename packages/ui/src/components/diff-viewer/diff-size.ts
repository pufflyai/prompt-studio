import { getFileExtension, imagePreviewExtensions, isImagePreviewPath } from "pstdio-file-types";

export const LARGE_DIFF_LINE_THRESHOLD = 1000;

const generatedDiffFileNames = new Set(["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

// Extensions whose byte content cannot be meaningfully shown as a unified diff.
// SVG is intentionally excluded — it is text-based XML and benefits from a line diff.
const binaryDiffExtensions = new Set([
  ...imagePreviewExtensions,
  "pdf",
  "zip",
  "tar",
  "gz",
  "tgz",
  "rar",
  "7z",
  "exe",
  "dll",
  "so",
  "dylib",
  "wasm",
  "class",
  "jar",
  "mp3",
  "mp4",
  "mov",
  "ogg",
  "wav",
  "webm",
  "flac",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "eot",
]);

export const getDiffLineCount = (input: {
  additions?: number;
  deletions?: number;
  oldContent?: string;
  newContent?: string;
}) => {
  return (input.additions ?? 0) + (input.deletions ?? 0);
};

export const isLargeDiffContent = (input: {
  additions?: number;
  deletions?: number;
  oldContent?: string;
  newContent?: string;
}) => {
  return getDiffLineCount(input) > LARGE_DIFF_LINE_THRESHOLD;
};

export const isGeneratedDiffPath = (path: string) => {
  const fileName = path.split(/[\\/]/).pop() ?? path;

  return generatedDiffFileNames.has(fileName) || fileName.endsWith(".min.js") || fileName.endsWith(".generated.ts");
};

export const isBinaryDiffPath = (path: string) => {
  const ext = getFileExtension(path);
  return ext.length > 0 && binaryDiffExtensions.has(ext);
};

export const isImageDiffPath = isImagePreviewPath;
