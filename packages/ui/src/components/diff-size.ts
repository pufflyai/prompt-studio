export const LARGE_DIFF_LINE_THRESHOLD = 1000;

const generatedDiffFileNames = new Set(["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

const countContentLines = (content: string | undefined) => {
  if (!content) return 0;

  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
};

export const getDiffLineCount = (input: {
  additions?: number;
  deletions?: number;
  oldContent?: string;
  newContent?: string;
}) => {
  const changedLines = (input.additions ?? 0) + (input.deletions ?? 0);
  const contentLines = countContentLines(input.oldContent) + countContentLines(input.newContent);

  return Math.max(changedLines, contentLines);
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
