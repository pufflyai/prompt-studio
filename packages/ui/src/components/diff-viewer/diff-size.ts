export const LARGE_DIFF_LINE_THRESHOLD = 1000;

const generatedDiffFileNames = new Set(["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

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
