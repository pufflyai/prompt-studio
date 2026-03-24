import { generateDiffFile } from "@git-diff-view/file";
import type { DiffViewProps } from "@git-diff-view/react";

const FALLBACK_OLD_PATH = "before.txt";
const FALLBACK_NEW_PATH = "after.txt";

interface ResolveDiffLanguageInput {
  language?: string;
  oldPath?: string;
  newPath?: string;
}

interface BuildDiffViewDataInput extends ResolveDiffLanguageInput {
  original: string;
  modified: string;
}

type DiffViewData = NonNullable<DiffViewProps<unknown>["data"]>;

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

export const buildDiffViewData = ({
  original,
  modified,
  language,
  oldPath,
  newPath,
}: BuildDiffViewDataInput): DiffViewData => {
  const oldFileName = oldPath ?? newPath ?? FALLBACK_OLD_PATH;
  const newFileName = newPath ?? oldPath ?? FALLBACK_NEW_PATH;
  const fileLanguage = resolveDiffLanguage({ language, oldPath, newPath });

  const diffFile = generateDiffFile(
    oldFileName,
    original,
    newFileName,
    modified,
    fileLanguage,
    fileLanguage,
    { context: 3 },
    "pstdio-diff-view",
  );

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
  };
};
