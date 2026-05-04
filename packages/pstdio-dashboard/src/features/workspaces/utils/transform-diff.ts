import type { Diff } from "@pstdio/ui";
import type { ApiFileDiff } from "@/shared/api-types";

export const transformFileDiffs = (files: ApiFileDiff[]): Diff[] =>
  files.map((file) => ({
    change: file.change,
    oldPath: file.oldPath ?? file.filePath,
    newPath: file.newPath ?? file.filePath,
    oldContent: file.oldContent,
    newContent: file.newContent,
    additions: file.additions,
    deletions: file.deletions,
  }));
